import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import type { FlatListProps } from "react-native"
import RNIImageViewer from "react-native-image-zoom-viewer"
import { HospitalitySlots } from "../../components/HospitalitySlots"
import { useCurrentConference } from "../../context/CurrentConferenceContext"
import { useFeatures } from "../../context/FeatureContext"
import { useTheme } from "../../context/ThemeContext"
import { withDeviceId } from "../../lib/supabase"
import { Activity, Food } from "../../types/activities"
import { Program } from "../../types/program"
import { Venue } from "../../types/venue"

// Helper function to format time objects to strings
const formatTimeValue = (time: any): string => {
  if (!time) return ""

  // If it's already a string, return it
  if (typeof time === "string") return time

  // If it's an object with time properties, try to format it
  if (typeof time === "object") {
    // Try common time object formats
    if (time.hour !== undefined && time.minute !== undefined) {
      const hour = time.hour
      const minute = time.minute.toString().padStart(2, "0")
      const period = hour >= 12 ? "PM" : "AM"
      const displayHour = hour % 12 === 0 ? 12 : hour % 12
      return `${displayHour}:${minute} ${period}`
    }

    // If it has a toString method, use it
    if (time.toString && typeof time.toString === "function") {
      return time.toString()
    }
  }

  // Fallback to string conversion
  return String(time)
}

// Remote asset URLs from Supabase
interface RemoteAssets {
  [key: string]: string
  hotelPlan: string
  secondFloor: string
  thirdFloor: string
  airportToHotel: string
  airportToHotelPublic: string
  walkingMap: string
}

const SUPABASE_URL =
  "https://oolqeopfhhiuvsmamxln.supabase.co/storage/v1/object/public/assets//"

const remoteAssets: RemoteAssets = {
  hotelPlan: `${SUPABASE_URL}hotel.png`,
  secondFloor: `${SUPABASE_URL}hotel.png`, // Assuming same image for now
  thirdFloor: `${SUPABASE_URL}hotel.png`, // Assuming same image for now
  airportToHotel: `${SUPABASE_URL}airport-to-hotel.png`,
  airportToHotelPublic: `${SUPABASE_URL}airport-to-hotel-public.png`,
  walkingMap: `${SUPABASE_URL}walking-map.png`
}

// Add helper function to open maps
const openMaps = (address: string) => {
  const encodedAddress = encodeURIComponent(address)
  const mapsUrl = Platform.select({
    ios: `maps:0,0?q=${encodedAddress}`,
    android: `geo:0,0?q=${encodedAddress}`,
    default: `https://maps.google.com/?q=${encodedAddress}`
  })

  Linking.canOpenURL(mapsUrl).then((supported) => {
    if (supported) {
      Linking.openURL(mapsUrl)
    } else {
      // Fallback to Google Maps web URL if app links not supported
      Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`)
    }
  })
}

// Fallback image URLs (using placeholder service with better visibility)
const FALLBACK_IMAGE =
  "https://placehold.co/600x400/CC0000/white/png?text=Image+Unavailable"

// Animated carousel wrapper component
const AnimatedCarousel = <T,>({
  triggerOnView = false,
  parentScrollView,
  ...props
}: FlatListProps<T> & {
  triggerOnView?: boolean
  parentScrollView?: React.RefObject<ScrollView>
}) => {
  const scrollViewRef = useRef<FlatList<T>>(null)
  const translateX = useRef(new Animated.Value(0)).current
  const viewRef = useRef<View>(null)
  const hasAnimated = useRef(false)

  const runWiggleAnimation = useCallback(() => {
    if (hasAnimated.current) return
    hasAnimated.current = true

    const wiggleAnimation = Animated.sequence([
      Animated.timing(translateX, {
        toValue: -20,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(translateX, {
        toValue: 20,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(translateX, {
        toValue: -10,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ])

    wiggleAnimation.start()
  }, [translateX])

  useEffect(() => {
    if (!triggerOnView) {
      // For Venue Maps - animate immediately after a short delay
      const timer = setTimeout(() => {
        runWiggleAnimation()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [runWiggleAnimation, triggerOnView])

  // Check if component is in view when it's scrolled
  const checkInView = useCallback(() => {
    if (!triggerOnView || !viewRef.current || hasAnimated.current) return

    viewRef.current.measureInWindow((x, y, width, height) => {
      const screenHeight = Dimensions.get("window").height
      // Check if at least 50% of the component is visible
      const visibleHeight = Math.min(screenHeight - y, height)
      const isVisible = visibleHeight > height * 0.5 && y < screenHeight

      if (isVisible && !hasAnimated.current) {
        setTimeout(() => {
          runWiggleAnimation()
        }, 300)
      }
    })
  }, [runWiggleAnimation, triggerOnView])

  // Set up scroll listener for parent ScrollView
  useEffect(() => {
    if (!triggerOnView) return

    // Check visibility on mount after a delay
    const initialCheck = setTimeout(checkInView, 100)

    // Also check on any scroll event (will be triggered by parent)
    const scrollCheckInterval = setInterval(checkInView, 200)

    return () => {
      clearTimeout(initialCheck)
      clearInterval(scrollCheckInterval)
    }
  }, [checkInView, triggerOnView])

  return (
    <Animated.View
      ref={viewRef}
      style={{ transform: [{ translateX }] }}
      onLayout={checkInView}
    >
      <FlatList<T> ref={scrollViewRef} {...props} />
    </Animated.View>
  )
}

// Map carousel item component
const MapItem = ({
  item,
  onPress,
  theme,
  testID
}: {
  item: { title: string; image: string; description: string }
  onPress: () => void
  theme: any
  testID?: string
}) => {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Updated getImageSource to handle URLs directly
  const getImageSource = () => {
    try {
      if (imageError) {
        return { uri: FALLBACK_IMAGE }
      }

      // If it's a URL, use it directly
      if (
        item.image &&
        typeof item.image === "string" &&
        (item.image.startsWith("http") || item.image.startsWith("https"))
      ) {
        console.log(`Using URL for venue map: ${item.image}`)
        return { uri: item.image }
      }

      // If no valid URL, use fallback
      console.warn(`Invalid image source: ${item.image}. Using fallback.`)
      setImageError(true)
      return { uri: FALLBACK_IMAGE }
    } catch (error) {
      console.error("Error getting image source:", error)
      setImageError(true)
      return { uri: FALLBACK_IMAGE }
    }
  }

  const source = getImageSource() // Get the source once
  const isFallback =
    typeof source === "object" &&
    "uri" in source &&
    source.uri === FALLBACK_IMAGE

  // Check if image is cached/already loaded
  useEffect(() => {
    if (
      !isFallback &&
      source &&
      "uri" in source &&
      typeof Image.queryCache === "function"
    ) {
      Image.queryCache([source.uri])
        .then((cached) => {
          const isImageCached = Object.keys(cached).length > 0
          if (isImageCached) {
            setIsLoading(false)
            setImageLoaded(true)
          }
        })
        .catch(() => {
          // Continue with normal loading if queryCache fails
        })
    }
  }, [isFallback, source])

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityLabel={`${item.title}. Tap to open zoomable map.`}
      onPress={() => {
        console.log("Pressed image:", item.title, item.image)
        // Only call onPress if it's not the fallback image (meaning a valid source was found)
        if (!isFallback) onPress()
      }}
      style={styles(theme).mapItem}
      activeOpacity={0.7}
      disabled={isFallback} // Disable if using fallback image
    >
      {isFallback ? (
        <View
          style={[
            styles(theme).imageContainer,
            styles(theme).placeholderContainer
          ]}
        >
          <Text style={styles(theme).placeholderText}>Map N/A</Text>
        </View>
      ) : (
        <View style={styles(theme).imageContainer}>
          {isLoading && !imageLoaded && (
            <View style={styles(theme).loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          )}
          <Image
            source={source} // Use the determined source
            style={styles(theme).mapImage}
            onError={(e) => {
              console.error(
                "Image loading error:",
                item.image,
                e.nativeEvent.error
              )
              setImageError(true)
              setIsLoading(false)
            }}
            onLoad={() => {
              console.log("Image loaded successfully:", item.image)
              setIsLoading(false)
              setImageLoaded(true)
            }}
            onLoadStart={() => {
              if (!imageLoaded) {
                setIsLoading(true)
              }
            }}
          />
        </View>
      )}
      <Text style={styles(theme).mapTitle}>{item.title}</Text>
      <Text style={styles(theme).mapDescription}>{item.description}</Text>
    </TouchableOpacity>
  )
}

// Image viewer component
const ImageViewer = ({
  visible,
  image,
  onClose,
  theme
}: {
  visible: boolean
  image: string | null
  onClose: () => void
  theme: any
}) => {
  const [imageError, setImageError] = useState(false)
  React.useEffect(() => {
    if (visible && image) {
      // Reset error state when modal becomes visible with a new image
      setImageError(false)
      // Initial loading state might still be relevant before library takes over? Or maybe not.
      // Let's simplify and rely on the library's loading indicator for now.
      // setIsLoading(true);
      // setImageLoaded(false);

      // Pre-fetching/cache check logic might be removed or adapted if library handles it.
      // Let's remove it for now to rely on the library.
      /*
      if (
        image &&
        typeof image === "string" &&
        (image.startsWith("http") ||
          remoteAssets[image as keyof RemoteAssets] !== undefined) &&
        typeof Image.queryCache === "function"
      ) {
        const uri = remoteAssets[image as keyof RemoteAssets] || image
        Image.queryCache([uri])
          .then((cached) => {
            const isImageCached = Object.keys(cached).length > 0
            if (isImageCached) {
              setIsLoading(false)
              setImageLoaded(true)
            }
          })
          .catch(() => {
            // Continue with normal loading if queryCache fails
          })
      }
      */
    }
  }, [visible, image])

  // getImageSource logic remains important to get the correct URI or fallback
  const getImageSource = (): { uri: string } => {
    // Add try-catch block around the entire logic
    try {
      if (imageError || !image) {
        console.log(
          "Modal: Using fallback because image is null or error state is true."
        )
        return { uri: FALLBACK_IMAGE }
      }
      // Check if it's a remote asset key first
      if (remoteAssets[image as keyof RemoteAssets]) {
        const source = { uri: remoteAssets[image as keyof RemoteAssets] }
        console.log(`Modal: Using remote asset for: ${image}`, source)
        return source
      }
      // Otherwise, assume it's a URL
      if (image.startsWith("http") || image.startsWith("https")) {
        console.log(`Modal: Using remote URL for: ${image}`)
        return { uri: image }
      }
      // Invalid source
      console.warn(
        `Modal: Invalid image source: ${image}. Setting error state.`
      )
      setImageError(true) // Set error state here
      return { uri: FALLBACK_IMAGE }
    } catch (error) {
      console.error("Error getting modal image source:", error)
      setImageError(true) // Set error on catch
      return { uri: FALLBACK_IMAGE }
    }
  }

  // Don't render anything if not visible or no image
  if (!visible || !image) return null

  const source = getImageSource() // Determine source URI

  // Prepare imageUrls for the react-native-image-zoom-viewer library
  const imageUrls = [{ url: source.uri }]

  // Use the react-native-image-zoom-viewer
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        testID="venue-map-viewer"
        accessibilityLabel="Zoomable venue map viewer"
        style={{ flex: 1 }}
      >
        <RNIImageViewer
          imageUrls={imageUrls}
          onCancel={onClose}
          enableSwipeDown // Optional: Allow swiping down to close
          doubleClickInterval={400}
          saveToLocalByLongPress={false} // Optional: Disable saving image
          renderIndicator={() => <View />} // Return an empty view instead of null
          loadingRender={() => (
            // Custom loading indicator
            <View style={styles(theme).modalOverlayContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
          failImageSource={{
            // Use the same fallback image URI
            url: FALLBACK_IMAGE,
            width: Dimensions.get("window").width,
            height: Dimensions.get("window").height
          }}
          // Optional: Add custom header or footer if needed, e.g., for the close button
          renderHeader={() => (
            <TouchableOpacity
              testID="venue-map-viewer-close"
              accessibilityLabel="Close zoomable venue map"
              style={styles(theme).closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <View style={styles(theme).closeButtonInner}>
                <Ionicons name="close" size={30} color="#ffffff" />
              </View>
            </TouchableOpacity>
          )}
          // Handle internal errors from the library
          onShowModal={() => setImageError(false)} // Reset error state when modal shown
          // Note: The library might have limited onError props. Error handling is mainly via failImageSource.

          // Pass theme styles or other props if needed by the library's components
          // style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }} // Example style override
        />
      </View>
      {/* Remove the old manual Image display and error/loading handling */}
      {/*
      <View style={styles(theme).modalContainer}>
        <TouchableOpacity
          style={styles(theme).closeButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <View style={styles(theme).closeButtonInner}>
            <Ionicons name="close" size={30} color="#ffffff" />
          </View>
        </TouchableOpacity>

        <View style={styles(theme).fullImageContainer}>
          {((isLoading && !imageLoaded) || isFallbackOrError) && (
            <View style={styles(theme).modalOverlayContainer}>
              {isLoading && !imageLoaded && !isFallbackOrError && (
                <ActivityIndicator size="large" color="#ffffff" />
              )}
              {isFallbackOrError && (
                <View style={styles(theme).errorContainer}>
                  <Ionicons
                    name="warning-outline"
                    size={40}
                    color="#ffffff"
                    style={{ marginBottom: 10 }}
                  />
                  <Text style={styles(theme).errorText}>
                    {imageError
                      ? "Failed to load image."
                      : "Image unavailable."}
                  </Text>
                </View>
              )}
            </View>
          )}

          {!isFallbackOrError && (
            <Image
              source={source}
              style={styles(theme).fullImage}
              resizeMode="contain"
              onError={(e) => {
                console.error(
                  "Modal image loading error:",
                  image,
                  e.nativeEvent.error
                )
                setImageError(true)
                setIsLoading(false)
              }}
              onLoad={() => {
                console.log("Modal image loaded successfully:", image)
                setIsLoading(false)
                setImageLoaded(true)
              }}
              onLoadStart={() => {
                if (!imageLoaded) {
                  setIsLoading(true)
                }
              }}
            />
          )}
        </View>
      </View>
      */}
    </Modal>
  )
}

// Amenities card component
const AmenitiesCard = ({
  amenities,
  theme
}: {
  amenities: Venue["amenities"] | undefined
  theme: any
}) => {
  if (!amenities || amenities.length === 0) {
    return (
      <View style={styles(theme).amenitiesCard}>
        <Text style={styles(theme).cardTitle}>Venue Amenities</Text>
        <Text style={styles(theme).amenityDescription}>
          No amenities information available.
        </Text>
      </View>
    )
  }
  return (
    <View style={styles(theme).amenitiesCard}>
      <Text style={styles(theme).cardTitle}>Venue Amenities</Text>
      {amenities.map((item, index) => (
        <View key={index} style={styles(theme).amenityItem}>
          <Text style={styles(theme).amenityTitle}>{item.name}</Text>
          <Text style={styles(theme).amenityDescription}>
            {item.description}
          </Text>
        </View>
      ))}
    </View>
  )
}

// Main Maps component
export default function Maps() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const screenWidth = Dimensions.get("window").width
  const { theme } = useTheme()
  const currentConference = useCurrentConference()
  const { isFeatureEnabled } = useFeatures()
  const router = useRouter()

  // State for fetched data, loading, and errors
  const [venueData, setVenueData] = useState<Venue | null>(null)
  const [activitiesData, setActivitiesData] = useState<Activity[]>([])
  const [foodData, setFoodData] = useState<Food[]>([])
  const [hospitalityData, setHospitalityData] = useState<
    Program["hospitality"] | null
  >(null)
  const [childcareContent, setChildcareContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calculated item width to ensure consistent sizing
  const itemWidth = screenWidth * 0.85 // Use 85% of screen width for card
  const itemSpacing = screenWidth * 0.05 // Use 5% for spacing (2.5% on each side)

  const programId =
    currentConference.status === "active"
      ? currentConference.currentProgramId
      : null

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        if (!programId) {
          setVenueData(null)
          setActivitiesData([])
          setFoodData([])
          setHospitalityData(null)
          setChildcareContent(null)
          return
        }

        // Fetch Venue data
        const supabaseWithDeviceId = await withDeviceId()
        const { data: venueResult, error: venueError } =
          await supabaseWithDeviceId
            .from("venues")
            .select("*")
            .eq("program_id", programId)
            .maybeSingle()

        if (venueError)
          throw new Error(`Venue fetch error: ${venueError.message}`)

        // Fix nested array issue - floors and amenities might be double-nested
        if (venueResult) {
          const fixedVenue = {
            ...venueResult,
            floors: Array.isArray(venueResult.floors?.[0])
              ? venueResult.floors[0]
              : venueResult.floors,
            amenities: Array.isArray(venueResult.amenities?.[0])
              ? venueResult.amenities[0]
              : venueResult.amenities
          }
          setVenueData(fixedVenue)
        } else {
          setVenueData(venueResult)
        }

        // Fetch Activities data
        const { data: activitiesResult, error: activitiesError } =
          await supabaseWithDeviceId
            .from("activities")
            .select("*")
            .eq("program_id", programId)

        if (activitiesError)
          throw new Error(`Activities fetch error: ${activitiesError.message}`)
        setActivitiesData(activitiesResult || [])

        // Fetch Food data
        const { data: foodResult, error: foodError } =
          await supabaseWithDeviceId
            .from("food")
            .select("*")
            .eq("program_id", programId)

        if (foodError) throw new Error(`Food fetch error: ${foodError.message}`)
        setFoodData(foodResult || [])

        // Fetch Program data for hospitality info and childcare content
        const { data: programResult, error: programError } =
          await supabaseWithDeviceId
            .from("programs")
            .select("hospitality, content")
            .eq("id", programId)
            .single()

        if (programError && programError.code !== "PGRST116") {
          throw new Error(`Program fetch error: ${programError.message}`)
        }
        setHospitalityData(programResult?.hospitality || null)
        setChildcareContent(programResult?.content?.childcare || null)
      } catch (err: any) {
        console.error("Failed to fetch map data:", err)
        setError(err.message || "Failed to load map information.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [programId])

  const handleImagePress = (imageSrc: string | null) => {
    if (imageSrc) {
      console.log("Image selected:", imageSrc)
      setSelectedImage(imageSrc)
    } else {
      console.log("Attempted to select null image.")
    }
  }

  // Render Loading state
  if (loading) {
    return (
      <View style={[styles(theme).container, styles(theme).centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Loading Maps...</Text>
      </View>
    )
  }

  // Render Error state
  if (error) {
    return (
      <View style={[styles(theme).container, styles(theme).centerContent]}>
        <Ionicons name="warning-outline" size={40} color={theme.colors.error} />
        <Text style={styles(theme).errorTextDisplay}>Error Loading Maps</Text>
        <Text style={styles(theme).errorTextDetails}>{error}</Text>
      </View>
    )
  }

  // Render content when data is loaded
  return (
    <ScrollView style={styles(theme).container}>
      {/* Venue Section */}
      <View style={styles(theme).section}>
        <Text style={styles(theme).sectionTitle}>Venue Maps</Text>
        {venueData && venueData.floors && venueData.floors.length > 0 ? (
          <AnimatedCarousel
            data={venueData.floors}
            renderItem={({ item, index }) => {
              // Use the URL directly from the database
              let imageSource: string = item?.url || FALLBACK_IMAGE

              if (!item?.url) {
                console.warn(
                  `No URL found for venue map: ${item?.name}. Using fallback.`
                )
              }

              return (
                <MapItem
                  item={{
                    title: item?.name || "Venue Map",
                    image: imageSource,
                    description: item?.description || ""
                  }}
                  onPress={() => handleImagePress(imageSource)}
                  theme={theme}
                  testID={`venue-map-${index}`}
                />
              )
            }}
            keyExtractor={(item, index) =>
              `venue-map-${item?.name || "map"}-${index}`
            }
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={itemWidth + itemSpacing} // Snap to card width + spacing
            snapToAlignment="center"
            decelerationRate="fast"
            contentContainerStyle={[
              styles(theme).mapList,
              { paddingHorizontal: itemSpacing / 2 }
            ]}
            pagingEnabled={false}
          />
        ) : (
          <Text style={styles(theme).noDataText}>No venue maps available.</Text>
        )}
        <AmenitiesCard amenities={venueData?.amenities} theme={theme} />
      </View>

      {/* Hospitality Section */}
      {hospitalityData && (
        <View style={styles(theme).section}>
          <Text style={styles(theme).sectionTitle}>Hospitality</Text>
          <View style={styles(theme).hospitalityCard}>
            <View style={styles(theme).hospitalityHeader}>
              <Ionicons
                name="location"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={styles(theme).hospitalityLocation}>
                {hospitalityData.location || "Location not available"}
              </Text>
            </View>
            <Text style={styles(theme).hospitalityTimesTitle}>Hours:</Text>
            {Array.isArray(hospitalityData.times) &&
            hospitalityData.times.length > 0 ? (
              hospitalityData.times.map((time, index) => (
                <View key={index} style={styles(theme).hospitalityTimeRow}>
                  <Text style={styles(theme).hospitalityDay}>{time.day}:</Text>
                  <Text style={styles(theme).hospitalityTime}>
                    {formatTimeValue(time.start_time)} -{" "}
                    {formatTimeValue(time.end_time)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles(theme).noDataText}>
                Schedule not available.
              </Text>
            )}

            {programId ? <HospitalitySlots programId={programId} /> : null}
          </View>
        </View>
      )}

      {/* Food Options Section */}
      <View style={styles(theme).section}>
        <Text style={styles(theme).sectionTitle}>Food Options</Text>
        {foodData.length > 0 ? (
          <AnimatedCarousel
            triggerOnView={true}
            data={foodData}
            renderItem={({ item }) => (
              <View style={styles(theme).activityCard}>
                <View style={styles(theme).activityHeader}>
                  <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
                    <Text
                      style={styles(theme).activityCategory}
                      numberOfLines={1}
                    >
                      {item.category}
                    </Text>
                    <Text style={styles(theme).activityTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => item.location && openMaps(item.location)}
                    style={styles(theme).mapButton}
                    disabled={!item.location}
                  >
                    <Ionicons
                      name="map-outline"
                      size={24}
                      color={
                        item.location
                          ? theme.colors.primary
                          : theme.colors.text.secondary
                      }
                    />
                  </TouchableOpacity>
                </View>
                {item.location && (
                  <Text
                    style={styles(theme).activityLocation}
                    numberOfLines={1}
                  >
                    {item.location}
                  </Text>
                )}
                {item.distance != null && (
                  <Text style={styles(theme).activityDistance}>
                    Approx. {item.distance} mi away
                  </Text>
                )}
                <Text
                  style={styles(theme).activityDescription}
                  numberOfLines={3}
                >
                  {item.description}
                </Text>
                {item.menu && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(item.menu!)}
                    style={styles(theme).viewImageButton}
                  >
                    <Text style={styles(theme).viewImageButtonText}>
                      View Menu
                    </Text>
                  </TouchableOpacity>
                )}
                {item.image && (
                  <TouchableOpacity
                    onPress={() => handleImagePress(item.image!)}
                    style={styles(theme).viewImageButton}
                  >
                    <Text style={styles(theme).viewImageButtonText}>
                      View Image
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            keyExtractor={(item) => `food-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={itemWidth + itemSpacing}
            snapToAlignment="center"
            decelerationRate="fast"
            contentContainerStyle={[
              styles(theme).mapList,
              { paddingHorizontal: itemSpacing / 2 }
            ]}
            pagingEnabled={false}
          />
        ) : (
          <Text style={styles(theme).noDataText}>
            No food options available.
          </Text>
        )}
      </View>

      {/* Childcare Information Section */}
      {childcareContent && isFeatureEnabled("child_care_enabled") && (
        <View style={styles(theme).section}>
          <Text style={styles(theme).sectionTitle}>Childcare Services</Text>
          <View style={styles(theme).childcareCard}>
            <View style={styles(theme).childcareHeader}>
              <Ionicons name="heart" size={24} color={theme.colors.primary} />
              <Text style={styles(theme).childcareTitle}>
                {childcareContent.title || "Safe, Supervised Care"}
              </Text>
            </View>
            <Text style={styles(theme).childcareDescription}>
              {childcareContent.description ||
                "We provide professional childcare services during conference events."}
            </Text>

            {childcareContent.features &&
              childcareContent.features.map((feature: any, index: number) => (
                <View key={index} style={styles(theme).childcareInfoRow}>
                  <Ionicons
                    name={feature.icon as any}
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text style={styles(theme).childcareInfoText}>
                    {feature.text}
                  </Text>
                </View>
              ))}

            {childcareContent.note && (
              <Text style={styles(theme).childcareNote}>
                {childcareContent.note}
              </Text>
            )}

            <TouchableOpacity
              style={styles(theme).childcareButton}
              onPress={() => router.push("/services/childcare")}
            >
              <Text style={styles(theme).childcareButtonText}>
                {childcareContent.linkText || "Request Childcare Services"}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Activities Section */}
      <View style={styles(theme).section}>
        <Text style={styles(theme).sectionTitle}>Local Activities</Text>
        {activitiesData.length > 0 ? (
          <AnimatedCarousel
            triggerOnView={true}
            data={activitiesData}
            renderItem={({ item }) => (
              <View style={styles(theme).activityCard}>
                <View style={styles(theme).activityHeader}>
                  <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
                    <Text
                      style={styles(theme).activityCategory}
                      numberOfLines={1}
                    >
                      {item.category}
                    </Text>
                    <Text style={styles(theme).activityTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => item.location && openMaps(item.location)}
                    style={styles(theme).mapButton}
                    disabled={!item.location}
                  >
                    <Ionicons
                      name="map-outline"
                      size={24}
                      color={
                        item.location
                          ? theme.colors.primary
                          : theme.colors.text.secondary
                      }
                    />
                  </TouchableOpacity>
                </View>
                {item.location && (
                  <Text
                    style={styles(theme).activityLocation}
                    numberOfLines={1}
                  >
                    {item.location}
                  </Text>
                )}
                {item.distance != null && (
                  <Text style={styles(theme).activityDistance}>
                    Approx. {item.distance} mi away
                  </Text>
                )}
                <Text
                  style={styles(theme).activityDescription}
                  numberOfLines={3}
                >
                  {item.description}
                </Text>
                {item.image && (
                  <TouchableOpacity
                    onPress={() => handleImagePress(item.image!)}
                    style={styles(theme).viewImageButton}
                  >
                    <Text style={styles(theme).viewImageButtonText}>
                      View Image
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            keyExtractor={(item) => `activity-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={itemWidth + itemSpacing} // Snap to card width + spacing
            snapToAlignment="center"
            decelerationRate="fast"
            contentContainerStyle={[
              styles(theme).mapList,
              { paddingHorizontal: itemSpacing / 2 }
            ]}
            pagingEnabled={false}
          />
        ) : (
          <Text style={styles(theme).noDataText}>
            No local activities information available.
          </Text>
        )}
      </View>

      {/* Image Viewer */}
      <ImageViewer
        visible={!!selectedImage}
        image={selectedImage}
        onClose={() => {
          console.log("Closing image viewer")
          setSelectedImage(null)
        }}
        theme={theme}
      />
    </ScrollView>
  )
}

// Define shadow styles separately to avoid TypeScript errors
const shadowStyles = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    section: {
      padding: theme.spacing.lg
    },
    sectionTitle: {
      ...theme.typography.h1,
      marginBottom: theme.spacing.lg,
      color: theme.colors.text.primary
    },
    mapList: {
      paddingVertical: theme.spacing.md
    },
    mapItem: {
      width: Dimensions.get("window").width * 0.85, // Match the itemWidth constant
      marginHorizontal: Dimensions.get("window").width * 0.025, // Half of the itemSpacing constant
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      overflow: "hidden",
      ...shadowStyles
    },
    imageContainer: {
      width: "100%",
      height: 200,
      position: "relative",
      backgroundColor: theme.colors.border,
      overflow: "hidden"
    },
    loadingContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.1)",
      zIndex: 1
    },
    loadingText: {
      marginTop: theme.spacing.md,
      ...theme.typography.body,
      color: theme.colors.text.secondary
    },
    mapImage: {
      width: "100%",
      height: 200,
      resizeMode: "cover"
    },
    mapTitle: {
      ...theme.typography.h2,
      padding: theme.spacing.md,
      color: theme.colors.text.primary
    },
    mapDescription: {
      ...theme.typography.body,
      padding: theme.spacing.md,
      paddingTop: 0,
      color: theme.colors.text.secondary
    },
    modalContainer: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.9)",
      justifyContent: "center",
      alignItems: "center"
    },
    closeButton: {
      position: "absolute",
      top: Platform.OS === "ios" ? 40 : 20,
      right: 20,
      zIndex: 10,
      padding: 8
    },
    closeButtonInner: {
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 20,
      padding: 5
    },
    fullImageContainer: {
      width: "90%",
      height: "80%",
      justifyContent: "center",
      alignItems: "center",
      position: "relative"
    },
    fullImage: {
      width: "100%",
      height: "100%"
    },
    modalOverlayContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "transparent"
    },
    errorContainer: {
      justifyContent: "center",
      alignItems: "center",
      padding: 20
    },
    errorText: {
      color: "#ffffff",
      fontSize: 16,
      textAlign: "center"
    },
    amenitiesCard: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      ...shadowStyles
    },
    cardTitle: {
      ...theme.typography.h2,
      marginBottom: theme.spacing.md,
      color: theme.colors.text.primary
    },
    amenityItem: {
      marginBottom: theme.spacing.md
    },
    amenityTitle: {
      ...theme.typography.body,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs
    },
    amenityDescription: {
      ...theme.typography.body,
      color: theme.colors.text.secondary
    },
    travelTimesCard: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      ...shadowStyles
    },
    travelTimeItem: {
      marginBottom: theme.spacing.md
    },
    travelTimeTitle: {
      ...theme.typography.body,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs
    },
    travelTimeDetail: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing.sm
    },
    activityCard: {
      width: Dimensions.get("window").width * 0.85, // Match the itemWidth constant
      marginHorizontal: Dimensions.get("window").width * 0.025, // Half of the itemSpacing constant
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      ...shadowStyles
    },
    activityHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: theme.spacing.sm
    },
    activityCategory: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: "bold",
      textTransform: "uppercase"
    },
    activityTitle: {
      ...theme.typography.h2,
      color: theme.colors.text.primary
    },
    mapButton: {
      padding: theme.spacing.xs
    },
    activityLocation: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs
    },
    activityDistance: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.sm
    },
    activityDescription: {
      ...theme.typography.body,
      color: theme.colors.text.secondary
    },
    centerContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg
    },
    errorTextDisplay: {
      marginTop: theme.spacing.md,
      ...theme.typography.h2,
      color: theme.colors.error,
      textAlign: "center"
    },
    errorTextDetails: {
      marginTop: theme.spacing.sm,
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center"
    },
    noDataText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center",
      paddingVertical: theme.spacing.lg,
      fontStyle: "italic"
    },
    placeholderContainer: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.border
    },
    placeholderText: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary
    },
    viewImageButton: {
      marginTop: theme.spacing.md,
      alignSelf: "flex-start",
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.primaryMuted,
      borderRadius: theme.borderRadius.sm
    },
    viewImageButtonText: {
      ...theme.typography.button,
      color: theme.colors.primary
    },
    hospitalityCard: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      ...shadowStyles
    },
    hospitalityHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.md
    },
    hospitalityLocation: {
      ...theme.typography.h3,
      color: theme.colors.text.primary,
      marginLeft: theme.spacing.sm
    },
    hospitalityTimesTitle: {
      ...theme.typography.body,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm
    },
    hospitalityTimeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.xs
    },
    hospitalityDay: {
      ...theme.typography.body,
      fontWeight: "600",
      color: theme.colors.text.primary
    },
    hospitalityTime: {
      ...theme.typography.body,
      color: theme.colors.text.secondary
    },
    childcareCard: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      ...shadowStyles
    },
    childcareHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.md
    },
    childcareTitle: {
      ...theme.typography.h3,
      color: theme.colors.text.primary,
      marginLeft: theme.spacing.sm,
      fontWeight: "bold"
    },
    childcareDescription: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.lg,
      lineHeight: 20
    },
    childcareInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.sm
    },
    childcareInfoText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginLeft: theme.spacing.sm
    },
    childcareNote: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      fontStyle: "italic",
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border
    },
    childcareButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.lg,
      gap: theme.spacing.sm
    },
    childcareButtonText: {
      ...theme.typography.button,
      color: "#ffffff",
      fontWeight: "600"
    }
  })
