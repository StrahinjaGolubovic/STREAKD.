/**
 * Converts image paths to use the API route for serving files
 * Handles both old format (/uploads/..., /profiles/...) and new format (/api/files/...)
 */
export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  
  // If already using API route, return as is
  if (path.startsWith('/api/files/')) {
    return path;
  }
  
  // Convert old format to new API route format
  if (path.startsWith('/uploads/')) {
    return `/api/files${path}`;
  }
  
  if (path.startsWith('/profiles/')) {
    return `/api/files${path}`;
  }
  
  // If path doesn't start with /, assume it's a relative path that needs /api/files prefix
  if (!path.startsWith('/')) {
    // Try to determine if it's an upload or profile
    if (path.includes('uploads/')) {
      return `/api/files/uploads/${path}`;
    }
    if (path.includes('profiles/')) {
      return `/api/files/profiles/${path}`;
    }
  }
  
  // Return as is if we can't determine the format
  return path;
}

