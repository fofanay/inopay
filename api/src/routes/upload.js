const router = require('express').Router();
const multer = require('multer');
const { minioClient, ensureBucket } = require('../config/minio');
const auth = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const bucket = req.body.bucket || 'documents';
    const docType = req.body.docType || '';
    await ensureBucket(bucket);
    const prefix = docType ? `${docType}-` : '';
    const filename = `${prefix}${Date.now()}-${req.file.originalname}`;
    await minioClient.putObject(bucket, filename, req.file.buffer, req.file.size, {
      'Content-Type': req.file.mimetype,
    });
    res.json({ success: true, bucket, filename, path: `${bucket}/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /upload/download?path=bucket/filename  — proxy stream from MinIO
router.get('/download', auth, async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: 'path requis' });
    const [bucket, ...parts] = String(path).split('/');
    const filename = parts.join('/');
    const stream = await minioClient.getObject(bucket, filename);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    stream.pipe(res);
  } catch (err) {
    res.status(404).json({ error: 'Document introuvable' });
  }
});

router.get('/:bucket/:filename', auth, async (req, res) => {
  try {
    const url = await minioClient.presignedGetObject(req.params.bucket, req.params.filename, 3600);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
