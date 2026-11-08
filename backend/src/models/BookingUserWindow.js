import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  reservations: [{ booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true } }]
}, { timestamps: true, versionKey: false });

export const BookingUserWindow = model('BookingUserWindow', schema);
