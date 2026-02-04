const express = require('express');
const { uploadImage, uploadMultipleImages, deleteImage } = require('../controllers/uploadController');
const upload = require('../middleware/upload');

const router = express.Router();

// POST /api/upload/image - Subir una imagen
router.post('/image', upload.single('image'), uploadImage);

// POST /api/upload/images - Subir multiples imagenes
router.post('/images', upload.array('images', 10), uploadMultipleImages);

// DELETE /api/upload/image/:publicId - Eliminar una imagen
router.delete('/image/:publicId', deleteImage);

module.exports = router;
