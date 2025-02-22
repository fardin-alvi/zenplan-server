require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {
    res.send("server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.utj4c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// client.connect()
//     .then(() => console.log("Connected to MongoDB"))
//     .catch(err => console.error("MongoDB connection failed:", err));

const userCollection = client.db("zenplano").collection("users");
const taskCollection = client.db("zenplano").collection("tasks");

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", 
        methods: ["GET", "POST"],
    },
});

app.post('/users', async (req, res) => {
    const user = req.body 
    const result = await userCollection.insertOne(user)
    res.send()
})

// Add new task
app.post("/tasks", async (req, res) => {
    const { title, description, category, userEmail } = req.body;
    const order = await taskCollection.countDocuments({ category }) + 1;

    const task = {
        title,
        description,
        category,
        order,
        userEmail,
        createdAt: new Date(),
    };

    const result = await taskCollection.insertOne(task);
    const insertedTask = await taskCollection.findOne({ _id: result.insertedId });
    io.emit("taskChange", { action: "create", task: insertedTask });

    res.send(insertedTask);
});

// Get all tasks sorted by category and order
app.get("/tasks", async (req, res) => {
    const { userEmail } = req.query;

    if (!userEmail) {
        return res.status(400).send({ error: "User email is required" });
    }

    const tasks = await taskCollection
        .find({ userEmail })
        .sort({ category: 1, order: 1 })
        .toArray();

    res.send(tasks);
});

// task insertation
app.post('/tasks', async (req, res) => {
    const task = {
        ...req.body,
        createdAt: new Date(),
        order: await taskCollection.countDocuments({ category: req.body.category }) + 1,
    };

    const result = await taskCollection.insertOne(task);
    const insertedTask = await taskCollection.findOne({ _id: result.insertedId });
    io.emit('taskChange', { action: 'create', task: insertedTask });
    res.send(insertedTask);
});

app.get('/tasks', async (req, res) => {
    const tasks = await taskCollection.find()
        .sort({ category: 1, order: 1 })
        .toArray();
    res.send(tasks);
});

// Task edit

app.patch('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    delete updates._id;

    if (updates.order) {
        await taskCollection.updateMany(
            {
                category: updates.category || req.body.originalCategory,
                order: { $gte: updates.order },
            },
            { $inc: { order: 1 } },
        );
    }

    const result = await taskCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: 'after' },
    );

    io.emit('taskChange', { action: 'update', task: result.value });
    res.send(result.value);
});

// Task delete

app.delete('/tasks/:id', async (req, res) => {
    const task = await taskCollection.findOne({ _id: new ObjectId(req.params.id) });
    await taskCollection.deleteOne({ _id: new ObjectId(req.params.id) });

    await taskCollection.updateMany(
        {
            category: task.category,
            order: { $gt: task.order },
        },
        { $inc: { order: -1 } },
    );

    io.emit('taskChange', { action: 'delete', taskId: req.params.id });
    res.send({ success: true });
});

server.listen(port, () => {
    console.log("Server is running on port", port);
});
