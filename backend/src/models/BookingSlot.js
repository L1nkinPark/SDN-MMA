import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  startsAt: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1 },
  reserved: { type: Number, default: 0, min: 0 }
}, { timestamps: true, versionKey: false });
schema.index({ place: 1, startsAt: 1 }, { unique: true });
export const BookingSlot = model('BookingSlot', schema);
