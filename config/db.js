const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('\n❌ MongoDB Connection Failed!');
    console.error(`   Error: ${error.message}`);
    console.error('\n💡 Fix: Check your MONGO_URI in backend/.env');
    console.error('   • For MongoDB Atlas: mongodb+srv://user:pass@cluster.mongodb.net/financeflow');
    console.error('   • Remove < > angle brackets from the password in the connection string\n');
    process.exit(1);
  }
};

module.exports = connectDB;
