const CLOUDINARY_CLOUD_NAME = 'ddnuuxh9t';

export function getOptimizedImageUrl(
  url: string | null | undefined,
  type: 'dp' | 'avatar' | 'card' | 'thumbnail' | 'detail' | 'large' | 'ad' | 'gallery' | 'story' | string
): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url; // Fallback for legacy base64
  
  if (url.includes(`res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`)) {
    let transformation = '';
    switch (type) {
      case 'dp':
      case 'avatar':
        transformation = 'w_150,h_150,c_fill,f_auto,q_auto';
        break;
      case 'card':
      case 'thumbnail':
        transformation = 'w_400,h_400,c_fill,f_auto,q_auto';
        break;
      case 'detail':
      case 'large':
        transformation = 'w_800,c_limit,f_auto,q_auto';
        break;
      case 'ad':
        transformation = 'w_800,h_400,c_fill,f_auto,q_auto';
        break;
      case 'gallery':
      case 'story':
        transformation = 'w_1080,c_limit,f_auto,q_auto';
        break;
      default:
        transformation = 'f_auto,q_auto';
    }
    return url.replace('/image/upload/', `/image/upload/${transformation}/`);
  }
  return url;
}
