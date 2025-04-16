# Supabase Edge Functions

This directory contains Edge Functions for the ICYPAA app.

## Functions

- `profile-pictures`: Handles uploading and deleting user profile pictures

## Deployment

To deploy these edge functions to your Supabase project, you'll need:

1. [Supabase CLI](https://supabase.com/docs/guides/cli) installed
2. Login to Supabase CLI:
   ```
   supabase login
   ```
3. Link your project (first time only):
   ```
   supabase link --project-ref oolqeopfhhiuvsmamxln
   ```
4. Deploy all functions:
   ```
   supabase functions deploy --project-ref oolqeopfhhiuvsmamxln
   ```
   
   Or deploy a specific function:
   ```
   supabase functions deploy profile_pictures --project-ref oolqeopfhhiuvsmamxln --no-verify-jwt
   ```

## Environment Variables

The Edge Functions require these environment variables:

- `SUPABASE_URL`: The URL of your Supabase project
- `SUPABASE_SERVICE_ROLE_KEY`: The service role key with admin privileges

Set environment variables with:

```
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key --project-ref oolqeopfhhiuvsmamxln
```

## Storage Configuration

The profile-pictures function requires a storage bucket called `user-uploads`. Make sure this bucket exists in your Supabase project with the appropriate permissions.

### Creating the Storage Bucket

1. Go to your Supabase dashboard
2. Navigate to Storage > Buckets
3. Click "Create Bucket"
4. Name it "user-uploads"
5. Configure the appropriate RLS policies for access control

## Usage

See the `lib/profilePicture.ts` file for client-side utilities to interact with these functions. 