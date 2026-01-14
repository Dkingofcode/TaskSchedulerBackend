const express = require('express');
const router = express.Router();
const Task = require("../models/Task");



// Get al Tasks
router.get('/', async (req, res) => {   
  try{
    const tasks = await Task.findAll();
    res.json(tasks);
  }catch(error){
    res.status(500).json({ message: error.message });
  }
});


// Create a task
router.post('/', async (req, res) => {
    const { title, description, dueDate, status } = req.body;
    try {
        const newTask = await Task.create({ title, description, dueDate, status });
        res.status(201).json(newTask);
    }catch(error){
        res.status(500).json({ message: error.message });
    }
});


// Get a task by ID
router.get('/:id', async (req, res) => {
    try {
        const task = await Task.findByPk(req.params.id);
        if (!task){
            return res.status(404).json({ message: "Task not found "});
        }
        res.json(task);
    }catch(error){
        res.status(500).json({ message: error.message });
    }
});


// Update a task by ID
router.put("/:id", async (req, res) => {
    const { title, description, dueDate, status } = req.body;
    try{
        const task = await Task.findByPk(req.params.id);
        if(!task){
            return res.status(404).json({ message: "task not found"});
        }
        await task.update({ title, description, dueDate, status });
        res.json(task);
    }catch (error){
        res.status(400).json({ message: error.message });
    }
});


// Delete a task by ID
router.delete('/:id', async (req, res) => {
    try{
        const task = await Task.findByPk(req.params.id);
        if(!task){
            return res.status(404).json({ message: "task not found"});
        }
        await task.destroy();
        res.json({ message: 'Task deleted' });
    }catch(error){
        res.status(500).json({ error: error.message });
    }
})



























