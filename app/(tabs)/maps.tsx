import { Ionicons } from "@expo/vector-icons"
import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageSourcePropType,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../../context/ThemeContext"
import { withDeviceId } from "../../lib/supabase"
import { Activity } from "../../types/activities"
import { Transportation } from "../../types/transportation"
import { Venue } from "../../types/venue"

// Restore local asset images
interface LocalAssets {
  [key: string]: ImageSourcePropType
  hotelPlan: ImageSourcePropType
  secondFloor: ImageSourcePropType
  thirdFloor: ImageSourcePropType
  airportToHotel: ImageSourcePropType
  airportToHotelPublic: ImageSourcePropType
  walkingMap: ImageSourcePropType
}

const localAssets: LocalAssets = {
  hotelPlan: require("../../assets/images/hotel.png"),
  secondFloor: require("../../assets/images/hotel.png"), // Assuming same image for now
  thirdFloor: require("../../assets/images/hotel.png"), // Assuming same image for now
  airportToHotel: require("../../assets/images/airport-to-hotel.png"),
  airportToHotelPublic: require("../../assets/images/airport-to-hotel-public.png"),
  walkingMap: require("../../assets/images/walking-map.png")
}

// Mapping functions to get local asset key from DB map name
const getVenueMapKey = (name: string): string | null => {
  const lowerName = name.toLowerCase()
  if (lowerName.includes("main floor")) return "hotelPlan"
  return null
}

const getTransportationMapKey = (name: string): string | null => {
  const lowerName = name.toLowerCase()
  if (
    lowerName.includes("airport to venue") ||
    lowerName.includes("airport to hotel")
  )
    return "airportToHotel"
  if (lowerName.includes("public transit")) return "airportToHotelPublic"
  if (lowerName.includes("walking map")) return "walkingMap"
  return null
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

// Map carousel item component
const MapItem = ({
  item,
  onPress,
  theme
}: {
  item: { title: string; image: string; description: string }
  onPress: () => void
  theme: any
}) => {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Updated getImageSource to prioritize localAssets
  const getImageSource = () => {
    try {
      if (imageError) {
        return { uri: FALLBACK_IMAGE }
      }
      // If it's a key in localAssets, use the local image
      if (item.image && localAssets[item.image as keyof LocalAssets]) {
        const source = localAssets[item.image as keyof LocalAssets]
        console.log(`Using local asset for: ${item.image}`, source)
        return source
      }
      // Otherwise, if it looks like a URL, treat it as one
      if (
        item.image &&
        (item.image.startsWith("http") || item.image.startsWith("https"))
      ) {
        console.log(`Using remote URL for: ${item.image}`)
        return { uri: item.image }
      }
      // If it's neither a valid key nor a URL, trigger error state
      console.warn(
        `Invalid image source: ${item.image}. Not found in localAssets and not a valid URL.`
      )
      setImageError(true) // Set error state immediately
      return { uri: FALLBACK_IMAGE } // Return fallback
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

  return (
    <TouchableOpacity
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
          {isLoading && (
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
            }}
            onLoadStart={() => setIsLoading(true)}
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
  const [isLoading, setIsLoading] = useState(true)

  React.useEffect(() => {
    if (visible && image) {
      setImageError(false)
      setIsLoading(true)
    }
  }, [visible, image])

  // Updated getImageSource for local assets and URLs
  const getImageSource = () => {
    try {
      if (imageError || !image) {
        return { uri: FALLBACK_IMAGE }
      }
      // Check if it's a local asset key first
      if (localAssets[image as keyof LocalAssets]) {
        const source = localAssets[image as keyof LocalAssets]
        console.log(`Modal: Using local asset for: ${image}`, source)
        return source
      }
      // Otherwise, assume it's a URL
      if (image.startsWith("http") || image.startsWith("https")) {
        console.log(`Modal: Using remote URL for: ${image}`)
        return { uri: image }
      }
      // Invalid source
      console.warn(`Modal: Invalid image source: ${image}`)
      setImageError(true)
      return { uri: FALLBACK_IMAGE }
    } catch (error) {
      console.error("Error getting modal image source:", error)
      setImageError(true)
      return { uri: FALLBACK_IMAGE }
    }
  }

  if (!image) return null

  const source = getImageSource() // Determine source
  const isFallbackOrError =
    imageError ||
    (typeof source === "object" &&
      "uri" in source &&
      source.uri === FALLBACK_IMAGE)

  return (
    <Modal visible={visible} transparent animationType="fade">
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
          {(isLoading || isFallbackOrError) && ( // Show overlay for loading or error/fallback
            <View style={styles(theme).modalOverlayContainer}>
              {isLoading && !isFallbackOrError && (
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
          {/* Conditionally render Image only when not loading initially and not error/fallback */}
          {!isFallbackOrError && (
            <Image
              source={source} // Use the determined source
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
              }}
              onLoadStart={() => setIsLoading(true)}
            />
          )}
        </View>
      </View>
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

// Travel times card component
const TravelTimesCard = ({
  details,
  theme
}: {
  details: Transportation["travel_details"] | undefined
  theme: any
}) => {
  if (!details || details.length === 0) {
    return (
      <View style={styles(theme).travelTimesCard}>
        <Text style={styles(theme).cardTitle}>Travel Details</Text>
        <Text style={styles(theme).travelTimeDetail}>
          No travel details available.
        </Text>
      </View>
    )
  }
  return (
    <View style={styles(theme).travelTimesCard}>
      <Text style={styles(theme).cardTitle}>Travel Details</Text>
      {details.map((item, index) => (
        <View key={index} style={styles(theme).travelTimeItem}>
          <Text style={styles(theme).travelTimeTitle}>{item.name}</Text>
          <Text style={styles(theme).travelTimeDetail}>{item.description}</Text>
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

  // State for fetched data, loading, and errors
  const [venueData, setVenueData] = useState<Venue | null>(null)
  const [transportationData, setTransportationData] =
    useState<Transportation | null>(null)
  const [activitiesData, setActivitiesData] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Assume program_id = 1 for now, replace with dynamic value later
  const programId = 1

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
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
        setVenueData(venueResult)

        // Fetch Transportation data
        const { data: transportResult, error: transportError } =
          await supabaseWithDeviceId
            .from("transportation")
            .select("*")
            .eq("program_id", programId)
            .maybeSingle()

        if (transportError)
          throw new Error(
            `Transportation fetch error: ${transportError.message}`
          )
        setTransportationData(transportResult)

        // Fetch Activities data
        const { data: activitiesResult, error: activitiesError } =
          await supabaseWithDeviceId
            .from("activities")
            .select("*")
            .eq("program_id", programId)

        if (activitiesError)
          throw new Error(`Activities fetch error: ${activitiesError.message}`)
        setActivitiesData(activitiesResult || [])
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
      {venueData && (
        <View style={styles(theme).section}>
          <Text style={styles(theme).sectionTitle}>Venue Maps</Text>
          {venueData.floors && venueData.floors.length > 0 ? (
            <FlatList
              data={venueData.floors}
              renderItem={({ item }) => {
                // Ensure imageSource is always a string
                let imageSource: string = FALLBACK_IMAGE
                const mapKey = getVenueMapKey(item.name)

                if (mapKey) {
                  imageSource = mapKey
                } else if (item.url) {
                  imageSource = item.url
                  console.warn(
                    `No local asset key found for venue map: ${item.name}. Falling back to URL: ${item.url}`
                  )
                } else {
                  console.warn(
                    `No local asset key or URL found for venue map: ${item.name}. Using fallback.`
                  )
                }

                return (
                  <MapItem
                    item={{
                      title: item.name,
                      image: imageSource,
                      description: item.description
                    }}
                    onPress={() => handleImagePress(imageSource)} // imageSource is guaranteed string
                    theme={theme}
                  />
                )
              }}
              keyExtractor={(item, index) => `venue-map-${item.name}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              decelerationRate="fast"
              snapToInterval={screenWidth - 40}
              contentContainerStyle={styles(theme).mapList}
            />
          ) : (
            <Text style={styles(theme).noDataText}>
              No venue maps available.
            </Text>
          )}
          <AmenitiesCard amenities={venueData.amenities} theme={theme} />
        </View>
      )}

      {/* Transportation Section */}
      {transportationData && (
        <View style={styles(theme).section}>
          <Text style={styles(theme).sectionTitle}>Transportation</Text>
          {transportationData.maps && transportationData.maps.length > 0 ? (
            <FlatList
              data={transportationData.maps}
              renderItem={({ item }) => {
                // Ensure imageSource is always a string
                let imageSource: string = FALLBACK_IMAGE
                const mapKey = getTransportationMapKey(item.name)

                if (mapKey) {
                  imageSource = mapKey
                } else if (item.url) {
                  imageSource = item.url
                  console.warn(
                    `No local asset key found for transportation map: ${item.name}. Falling back to URL: ${item.url}`
                  )
                } else {
                  console.warn(
                    `No local asset key or URL found for transportation map: ${item.name}. Using fallback.`
                  )
                }

                return (
                  <MapItem
                    item={{
                      title: item.name,
                      image: imageSource,
                      description: item.description
                    }}
                    onPress={() => handleImagePress(imageSource)} // imageSource is guaranteed string
                    theme={theme}
                  />
                )
              }}
              keyExtractor={(item, index) =>
                `transport-map-${item.name}-${index}`
              }
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              decelerationRate="fast"
              snapToInterval={screenWidth - 40}
              contentContainerStyle={styles(theme).mapList}
            />
          ) : (
            <Text style={styles(theme).noDataText}>
              No transportation maps available.
            </Text>
          )}
          <TravelTimesCard
            details={transportationData.travel_details}
            theme={theme}
          />
        </View>
      )}

      {/* Activities Section */}
      <View style={styles(theme).section}>
        <Text style={styles(theme).sectionTitle}>Local Activities</Text>
        {activitiesData.length > 0 ? (
          <FlatList
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
            snapToAlignment="start"
            decelerationRate="fast"
            snapToInterval={screenWidth - 40}
            contentContainerStyle={styles(theme).mapList}
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
      paddingHorizontal: theme.spacing.sm
    },
    mapItem: {
      width: Dimensions.get("window").width - 80,
      marginHorizontal: theme.spacing.sm,
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
      top: 40,
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
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 5
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
      width: Dimensions.get("window").width - 80,
      marginHorizontal: theme.spacing.sm,
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
    }
  })
