import { v2 as cloudinary } from 'cloudinary';
import { HttpError } from '../utils/common.js';

export function assertSupportedImage(file) {
  const bytes = file?.buffer;
  const mime = file?.mimetype;
  const png = mime === 'image/png' && bytes?.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = mime === 'image/jpeg' && bytes?.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = mime === 'image/webp' && bytes?.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) throw new HttpError(400, 'File content does not match a supported image format');
}

export async function uploadPlaceImage(file) {
  assertSupportedImage(file);
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new HttpError(503, 'Cloudinary is not configured');
  }
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
  const result = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`, { folder: 'studyspot/places', resource_type: 'image' });
  return result.secure_url;
}
