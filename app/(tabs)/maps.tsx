import { Ionicons } from "@expo/vector-icons"
import React, { useState } from "react"
import {
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
import { useTheme } from "../../context/ThemeContext"

// Import programData
import { programData } from "../../data/programData"

// Mock data structure
const mapData = {
  venue: {
    name: "Seattle Convention Center",
    address: "705 Pike St, Seattle, WA 98101",
    maps: [
      {
        id: 1,
        title: "Main Floor Plan",
        image: "main-floor.jpg", // These would be actual image paths
        description:
          "Main convention level with registration desk, main meeting halls, and primary panel rooms"
      },
      {
        id: 2,
        title: "Second Floor Plan",
        image: "second-floor.jpg",
        description:
          "Breakout rooms, smaller meeting spaces, and additional seating areas"
      },
      {
        id: 3,
        title: "Third Floor Plan",
        image: "third-floor.jpg",
        description: "Hospitality suites and marathon meeting rooms"
      }
    ],
    amenities: {
      bathrooms: {
        count: 12,
        description: "Multiple accessible restrooms on each floor"
      },
      wifi: {
        available: true,
        network: "ICYPAA-2024",
        description: "Free high-speed WiFi throughout the venue"
      },
      accessibility: {
        elevators: 4,
        ramps: "All areas accessible",
        description:
          "Full ADA compliance with accessible entrances and facilities"
      },
      parking: {
        available: true,
        description: "On-site parking garage, $15/day with validation"
      },
      food: {
        options: ["Café", "Vending machines", "Restaurant"],
        description: "Multiple dining options within the venue"
      }
    }
  },
  transportation: {
    maps: [
      {
        id: 1,
        title: "Airport to Venue",
        image: "airport-route.jpg",
        description:
          "Direct light rail route from SeaTac Airport to Convention Center Station"
      },
      {
        id: 2,
        title: "Public Transit Overview",
        image: "transit-map.jpg",
        description:
          "Key bus and light rail routes serving the convention center"
      },
      {
        id: 3,
        title: "Walking Map",
        image: "walking-map.jpg",
        description: "Walking routes from nearby hotels and attractions"
      }
    ],
    travelTimes: {
      airport: {
        car: "25-35 minutes",
        publicTransit: "40-45 minutes (Light Rail)",
        shuttle: "35-45 minutes",
        cost: "$3-45 depending on mode"
      },
      downtown: {
        walking: "5-15 minutes from most downtown hotels",
        publicTransit: "5-10 minutes",
        car: "5-10 minutes"
      },
      parking: {
        locations: [
          "Convention Center Garage",
          "Pacific Place",
          "Street parking"
        ],
        rates: "$15-25/day"
      }
    }
  }
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

// Image viewer component
const ImageViewer = ({
  visible,
  image,
  onClose,
  theme
}: {
  visible: boolean
  image: string
  onClose: () => void
  theme: any
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles(theme).modalContainer}>
      <TouchableOpacity style={styles(theme).closeButton} onPress={onClose}>
        <Ionicons name="close" size={30} color={theme.colors.background} />
      </TouchableOpacity>
      <Image
        source={{ uri: image }}
        style={styles(theme).fullImage}
        resizeMode="contain"
      />
    </View>
  </Modal>
)

// Map carousel item component
const MapItem = ({
  item,
  onPress,
  theme
}: {
  item: { title: string; image: string; description: string }
  onPress: () => void
  theme: any
}) => (
  <TouchableOpacity onPress={onPress} style={styles(theme).mapItem}>
    <Image source={{ uri: item.image }} style={styles(theme).mapImage} />
    <Text style={styles(theme).mapTitle}>{item.title}</Text>
    <Text style={styles(theme).mapDescription}>{item.description}</Text>
  </TouchableOpacity>
)

// Amenities card component
const AmenitiesCard = ({
  amenities,
  theme
}: {
  amenities: typeof mapData.venue.amenities
  theme: any
}) => (
  <View style={styles(theme).amenitiesCard}>
    <Text style={styles(theme).cardTitle}>Venue Amenities</Text>
    {Object.entries(amenities).map(([key, value]) => (
      <View key={key} style={styles(theme).amenityItem}>
        <Text style={styles(theme).amenityTitle}>
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </Text>
        <Text style={styles(theme).amenityDescription}>
          {typeof value === "object" ? value.description : value}
        </Text>
      </View>
    ))}
  </View>
)

// Travel times card component
const TravelTimesCard = ({
  times,
  theme
}: {
  times: typeof mapData.transportation.travelTimes
  theme: any
}) => (
  <View style={styles(theme).travelTimesCard}>
    <Text style={styles(theme).cardTitle}>Travel Times</Text>
    {Object.entries(times).map(([key, value]) => (
      <View key={key} style={styles(theme).travelTimeItem}>
        <Text style={styles(theme).travelTimeTitle}>
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </Text>
        {Object.entries(value).map(([subKey, subValue]) => (
          <Text key={subKey} style={styles(theme).travelTimeDetail}>
            • {subKey}: {subValue}
          </Text>
        ))}
      </View>
    ))}
  </View>
)

// Add Activities section to Maps page
export default function Maps() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const screenWidth = Dimensions.get("window").width
  const { theme } = useTheme()

  return (
    <ScrollView style={styles(theme).container}>
      {/* Venue Section */}
      <View style={styles(theme).section}>
        <Text style={styles(theme).sectionTitle}>Venue Maps</Text>
        <FlatList
          data={mapData.venue.maps}
          renderItem={({ item }) => (
            <MapItem
              item={item}
              onPress={() => setSelectedImage(item.image)}
              theme={theme}
            />
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          snapToInterval={screenWidth - 40}
          contentContainerStyle={styles(theme).mapList}
        />
        <AmenitiesCard amenities={mapData.venue.amenities} theme={theme} />
      </View>

      {/* Transportation Section */}
      <View style={styles(theme).section}>
        <Text style={styles(theme).sectionTitle}>Transportation</Text>
        <FlatList
          data={mapData.transportation.maps}
          renderItem={({ item }) => (
            <MapItem
              item={item}
              onPress={() => setSelectedImage(item.image)}
              theme={theme}
            />
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          snapToInterval={screenWidth - 40}
          contentContainerStyle={styles(theme).mapList}
        />
        <TravelTimesCard
          times={mapData.transportation.travelTimes}
          theme={theme}
        />
      </View>

      {/* Activities Section - New */}
      <View style={styles(theme).section}>
        <Text style={styles(theme).sectionTitle}>Local Activities</Text>
        <FlatList
          data={programData.activities}
          renderItem={({ item }) => (
            <View style={styles(theme).activityCard}>
              <View style={styles(theme).activityHeader}>
                <View>
                  <Text style={styles(theme).activityCategory}>
                    {item.category}
                  </Text>
                  <Text style={styles(theme).activityTitle}>{item.title}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => openMaps(item.location)}
                  style={styles(theme).mapButton}
                >
                  <Ionicons
                    name="map-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles(theme).activityLocation}>
                {item.location}
              </Text>
              <Text style={styles(theme).activityDistance}>
                {item.distance}
              </Text>
              <Text style={styles(theme).activityDescription}>
                {item.description}
              </Text>
            </View>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          snapToInterval={screenWidth - 40}
          contentContainerStyle={styles(theme).mapList}
        />
      </View>

      <ImageViewer
        visible={!!selectedImage}
        image={selectedImage || ""}
        onClose={() => setSelectedImage(null)}
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

const styles = (theme) =>
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
    mapImage: {
      width: "100%",
      height: 200,
      backgroundColor: theme.colors.border // Placeholder color
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
      zIndex: 1
    },
    fullImage: {
      width: "100%",
      height: "80%"
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
    }
  })
