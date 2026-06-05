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
        transformation = 'w_240,h_240,c_fill,f_auto,q_auto';
        break;
      case 'card':
      case 'thumbnail':
        transformation = 'w_480,h_480,c_fill,f_auto,q_auto';
        break;
      case 'detail':
      case 'large':
        transformation = 'w_1000,c_limit,f_auto,q_auto';
        break;
      case 'ad':
        transformation = 'w_1000,h_500,c_fill,f_auto,q_auto';
        break;
      case 'gallery':
      case 'story':
        transformation = 'w_1200,c_limit,f_auto,q_auto';
        break;
      default:
        transformation = 'f_auto,q_auto';
    }
    return url.replace('/image/upload/', `/image/upload/${transformation}/`);
  }
  return url;
}
