const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');
const path = require('path');

/**
 * Subir una imagen a Cloudinary
 * POST /api/upload/image
 */
async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporciono ninguna imagen'
      });
    }

    const originalName = path.parse(req.file.originalname).name;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'utilesya/products',
        public_id: originalName,
        resource_type: 'image',
        overwrite: true
      },
      (error, result) => {
        if (error) {
          console.error('Error al subir imagen a Cloudinary:', error.message || error);
          console.error('Cloudinary error details:', JSON.stringify(error, null, 2));
          return res.status(500).json({
            success: false,
            message: 'Error al subir la imagen',
            error: error.message || 'Error desconocido de Cloudinary'
          });
        }

        res.json({
          success: true,
          message: 'Imagen subida exitosamente',
          data: {
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.bytes
          }
        });
      }
    );

    const bufferStream = Readable.from(req.file.buffer);
    bufferStream.pipe(stream);
  } catch (error) {
    console.error('Error en uploadImage:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la imagen'
    });
  }
}

/**
 * Subir multiples imagenes a Cloudinary
 * POST /api/upload/images
 */
async function uploadMultipleImages(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron imagenes'
      });
    }

    if (req.files.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximo 10 imagenes por vez'
      });
    }

    const uploadPromises = req.files.map(file => {
      return new Promise((resolve, reject) => {
        const originalName = path.parse(file.originalname).name;

        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'utilesya/products',
            public_id: originalName,
            resource_type: 'image',
            overwrite: true
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve({
                url: result.secure_url,
                publicId: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                size: result.bytes
              });
            }
          }
        );

        const bufferStream = Readable.from(file.buffer);
        bufferStream.pipe(stream);
      });
    });

    const uploadedImages = await Promise.all(uploadPromises);

    res.json({
      success: true,
      message: `${uploadedImages.length} imagenes subidas exitosamente`,
      data: {
        images: uploadedImages
      }
    });
  } catch (error) {
    console.error('Error en uploadMultipleImages:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar las imagenes'
    });
  }
}

/**
 * Eliminar una imagen de Cloudinary
 * DELETE /api/upload/image/:publicId
 */
async function deleteImage(req, res) {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID es requerido'
      });
    }

    const decodedPublicId = decodeURIComponent(publicId);
    const result = await cloudinary.uploader.destroy(decodedPublicId);

    if (result.result === 'ok') {
      res.json({
        success: true,
        message: 'Imagen eliminada exitosamente'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Imagen no encontrada'
      });
    }
  } catch (error) {
    console.error('Error en deleteImage:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la imagen'
    });
  }
}

module.exports = {
  uploadImage,
  uploadMultipleImages,
  deleteImage
};
