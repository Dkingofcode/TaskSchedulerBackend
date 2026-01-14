const { Sequelize } = require("sequelize");
require('dotenv').config();


const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
});


const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully');
    }catch(error){
        console.log('Unable to connect to the database:', error);
    }
};

module.exports = { sequelize, connectDB };


