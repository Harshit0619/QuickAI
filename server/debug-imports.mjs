const modules = ['express','cors','dotenv/config','@clerk/express','./routes/aiRoutes.js','./configs/cloudinary.js','./routes/userRoutes.js','@neondatabase/serverless','cloudinary','multer','openai','pdf-parse'];

(async () => {
  for (const mod of modules) {
    try {
      console.log('Trying import:', mod);
      const m = await import(mod);
      console.log('Imported ok:', mod);
    } catch (err) {
      console.error('Failed to import:', mod);
      console.error(err);
      process.exit(1);
    }
  }
  console.log('All imports ok');
})();
