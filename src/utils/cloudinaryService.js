// Replace with your actual Cloudinary Cloud Name and unsigned Upload Preset
const CLOUD_NAME = 'dkr8ts3sy';
const UPLOAD_PRESET = 'music_app_preset';

export async function uploadToCloudinary(file, resourceType = 'auto') {
  if (!file) throw new Error('No file provided for upload.');

  // For audio/video files, Cloudinary requires 'video' or 'auto'
  const endpointType = (file.type.startsWith('audio/') || file.type.startsWith('video/')) ? 'video' : resourceType;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpointType}/upload`;

  const res = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(
      errorJson.error?.message || `Cloudinary upload failed with HTTP status ${res.status}`
    );
  }

  const data = await res.json();
  return data.secure_url || data.url;
}