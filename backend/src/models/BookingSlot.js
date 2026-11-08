import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  startsAt: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1 },
  reserved: { type: Number, default: 0, min: 0 },
  reservations: [{ booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    partySize: { type: Number, required: true, min: 1 } }]
}, { timestamps: true, versionKey: false });
schema.index({ place: 1, startsAt: 1 }, { unique: true });
schema.index({ startsAt: 1 });
export const BookingSlot = model('BookingSlot', schema);
