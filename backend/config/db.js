import dns from 'node:dns/promises';
import mongoose from 'mongoose';

dns.setServers(['1.1.1.1', '8.8.8.8']);

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/padelitico';
  await mongoose.connect(uri);
  console.log('MongoDB conectado:', uri);
}

export default connectDB;
