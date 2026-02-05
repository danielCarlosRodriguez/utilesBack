const express = require('express');
const { uploadImage, uploadMultipleImages, deleteImage } = require('../controllers/uploadController');
const upload = require('../middleware/upload');

const router = express.Router();

// Wrapper para Multer 2.x: necesita (req, res, next)
function multerSingle(fieldName) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, next);
  };
}

function multerArray(fieldName, maxCount) {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, next);
  };
}

// POST /api/upload/image - Subir una imagen
router.post('/image', multerSingle('image'), uploadImage);

// POST /api/upload/images - Subir multiples imagenes
router.post('/images', multerArray('images', 10), uploadMultipleImages);

// DELETE /api/upload/image/:publicId - Eliminar una imagen
router.delete('/image/:publicId', deleteImage);

module.exports = router;
