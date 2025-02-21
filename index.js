require('dotenv').config()
const express = require("express")
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send('server is running')
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.utj4c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

client.connect()
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection failed:", err));

const userCollection = client.db("zenplano").collection("user");


app.post('/user', async (req, res) => {
    const user = req.body;
    const query = { email: user.email }
    const existingUser = await userCollection.findOne(query)
    if (existingUser) {
        return res.send({message:"User Already Exist"})
    }
    const result = await userCollection.insertOne(user);
    res.send(result);
});

app.listen(port, () => {
    console.log('Server is running on port', port);
});
