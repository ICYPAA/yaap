# ICYPAA Mobile App

## Overview

The ICYPAA mobile application is a conference guide built with React Native, TypeScript, and Expo. It utilizes a Supabase backend and is engineered with two primary philosophies: robust offline-first functionality and network efficiency. The app is designed to serve as an indispensable tool for conference attendees while prioritizing user anonymity, a cornerstone of its design.

The application is segmented into five distinct sections, four of which are publicly accessible to all attendees. The fifth section, "Host," is restricted to the host committee and requires authentication.

## Core Principles

* **Anonymity First**: The app is designed from the ground up to protect user anonymity. Profile creation is optional, requires minimal personally identifiable information (PII), and all data sharing is explicit and user-revocable.
* **Offline-First**: The app caches all essential conference data locally. Users can browse the program, view maps, and access their saved schedule without an active internet connection.
* **Network Efficiency**: Data fetching is optimized to minimize network requests, ensuring a fast user experience and conserving battery life and data usage.

---

## App Structure

### 1. Program

This section provides a comprehensive guide to all conference events.

* **Event Schedule**: View all events organized by day.
* **Multiple Views**: Toggle between a `Timeline View` for a chronological overview and a `List View` for detailed Browse.
* **Advanced Filtering**: Filter events by type (e.g., Speaker Meeting, Workshop, Marathon Meeting) to easily find events of interest.
* **Personalized Schedule**: Save events to create a custom schedule.
* **Social Integration**: The curated schedule displays details for saved events, including friends who have also saved that event (if sharing is enabled).
* **Schedule Sharing**: A personal QR code allows users to securely share their schedule with others.

### 2. Accommodations

This section centralizes all venue-related information.

* **Venue Details**: Access venue maps and a directory of available amenities.
* **Hospitality Suite**: View current hospitality hours and see which group is presently hosting the suite.
* **Full Hospitality Schedule**: A collapsible list detailing the full schedule of hosting groups and their time slots throughout the conference.
* **Local Food**: A carousel showcasing nearby restaurants and on-site food options.
* **Child Care**: An informational card explaining the available child care services, with a link to the main Child Care page in the "Services" section.
* **Local Activities**: A carousel of recommended local attractions and points of interest.

### 3. Services

This section is a hub for support, service opportunities, and general help. It is organized by the direction of service.

* **For Attendees (The Conference Helps You)**
    * **Accessibility Services**: A form to request accessibility accommodations.
    * **Child Care Services**: Detailed information and contact points for child care.
* **For the Conference (You Help the Conference)**
    * **Volunteer**: Information on volunteering opportunities and responsibilities.
    * **Hospitality Updates**: A channel for hospitality hosts to provide real-time updates.
* **Other Resources**
    * **Support Chat**: A contact point for general questions or support.
    * **FAQ**: A section with answers to frequently asked questions.

### 4. Profile

The Profile section is optional but required for social features. It is designed with maximum user control and privacy.

* **Minimal Data**: Profile creation only requires a profile picture, first name, and last initial to protect anonymity.
* **App Customization**:
    * Language selection.
    * Theme selection (e.g., light/dark mode).
* **Notification Management**: Granular control over push notifications for various categories (e.g., schedule updates, hospitality updates).
* **Other Settings**: Toggle for conference-specific features (e.g., Bid Schedule visibility).
* **Danger Zone**: Contains a button to permanently delete the user's account and all associated data.

#### Schedule Sharing & Privacy

This sub-section provides users with complete control over their social connections and data.

* **Management Lists**:
    * **Incoming Requests**: Approve or deny requests from other users.
    * **Currently Sharing With**: A list of users who can see your schedule.
    * **People You Are Following**: A list of users whose schedules you can see.
    * **Banned Users**: A list of users who cannot request to see your schedule.
* **User-Controlled Sharing Flow**: The sharing process is designed to be explicit and require mutual consent.
    1.  User A allows User B to scan their QR code.
    2.  User B's app shows a pending request sent to User A.
    3.  User A receives the request from User B and must explicitly approve it.
    4.  Once approved, User B can view User A's saved schedule.
    5.  Either user can revoke access at any time, instantly severing the connection.
    6.  If User A bans User B, User B can no longer see User A's schedule or send new requests.

### 5. Host (Restricted Access)

This section is exclusively for the conference host committee and is protected by a multi-step authentication process.

* **Service Request Management**: Allows hosts to view and manage incoming requests from the "Services" section (e.g., accessibility, child care).
* **Role-Based Access Control (RBAC)**: Utilizes Supabase policies to grant different levels of access within the Host section based on a user's role on the committee.
* **Chairperson Schedule**: When logged in, a host committee member assigned as a chairperson for an event will see a personalized view of their specific responsibilities and schedule.

#### Authentication Flow

1.  **Primary Authentication**: The main login method is via Discord OAuth (provided by Supabase Auth).
2.  **Server Authorization**: After a successful Discord login, the system verifies that the authenticated user is a member of a specific, private Discord server for the host committee. Access is denied if they are not a member.
3.  **Backup Authentication**: An administrator can create traditional email/password accounts as a fallback.
4.  **Apple Login**: Apple login is included for iOS App Store compliance but is not the primary authentication method.