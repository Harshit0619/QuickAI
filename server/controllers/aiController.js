import { GoogleGenerativeAI } from "@google/generative-ai";
import sql from "../configs/db.js";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { clerkClient } from "@clerk/express";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModelName = (process.env.GEMINI_MODEL || "gemini-2.0-flash").replace(/^models\//, "");
const model = genAI.getGenerativeModel({ model: geminiModelName });

export const generateArticle = async(req,res)=> {
        try {
            const {userId} = req.auth();
            const{prompt , length} = req.body;
            const plan = req.plan;
            const free_usage = req.free_usage;
            
            if(plan !== 'premium' && free_usage >= 10) {
                return res.json({success:false , message : 'Free usage limit exceeded. Please upgrade to premium plan.'})
            }

            const response = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }],
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: length,
                },
            });

            const content = response.response.text();

            await sql`INSERT INTO creations (user_id , prompt , content , type)
            VALUES (${userId} , ${prompt} , ${content} , 'article')`;

            if(plan !== 'premium'){
                await clerkClient.users.updateUserMetadata(userId,{
                    privateMetadata:{
                        free_usage: free_usage + 1
                    }
                })
            }
            res.json({success:true , content})

        } catch (error) {
            console.log("generateArticle Error:", JSON.stringify({
                message: error.message,
                status: error.status,
                errorText: error.error_description || error.details,
                fullError: error
            }, null, 2));
            res.json({success:false , message : error.message})
        }
}


export const generateBlogTitle = async(req,res)=> {
        try {
            const {userId} = req.auth();
            const{prompt } = req.body;
            const plan = req.plan;
            const free_usage = req.free_usage;
            
            if(plan !== 'premium' && free_usage >= 10) {
                return res.json({success:false , message : 'Free usage limit exceeded. Please upgrade to premium plan.'})
            }

            const response = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }],
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 100,
                },
            });

            const content = response.response.text();

            await sql`INSERT INTO creations (user_id , prompt , content , type)
            VALUES (${userId} , ${prompt} , ${content} , 'blog-title')`;

            if(plan !== 'premium'){
                await clerkClient.users.updateUserMetadata(userId,{
                    privateMetadata:{
                        free_usage: free_usage + 1
                    }
                })
            }
            res.json({success:true , content})

        } catch (error) {
            console.log("generateBlogTitle Error:", error);
            console.log("Error response:", error.response?.data || error.message);
            res.json({success:false , message : error.message})
        }
}


export const generateImage = async(req,res)=> {
        try {
            const {userId} = req.auth();
            const{prompt , publish } = req.body;
            const plan = req.plan;
           
            
            if(plan !== 'premium' ) {
                return res.json({success:false , message : 'This feature is only available for premium subscriptions.'})
            }

            const formData = new FormData()
            formData.append('prompt', prompt)
            

             const {data} =  await axios.post('https://clipdrop-api.co/text-to-image/v1' ,  formData ,  {
                headers : { 'x-api-key': process.env.CLIPDROP_API_KEY,},
                responseType:"arraybuffer",
            })
          
            const base64Image = `data:image/png;base64,${Buffer.from(data,'binary').
                toString('base64')}`;

            const {secure_url} = await cloudinary.uploader.upload(base64Image)     



            await sql`INSERT INTO creations (user_id , prompt , content , type , publish)
            VALUES (${userId} , ${prompt} , ${secure_url} , 'image' , ${publish ?? false})`;

          
            res.json({success:true , content: secure_url})

        } catch (error) {
            console.log("generateImage Error:", error);
            console.log("Error response:", error.response?.data || error.message);
            res.json({success:false , message : error.message})
        }
}


export const removeImageBackground = async(req,res) => {
        try {
            const {userId} = req.auth();
            const image = req.file;
            const plan = req.plan;
           
            
            if(plan !== 'premium' ) {
                return res.json({success:false , message : 'This feature is only available for premium subscriptions.'})
            }

          

            const {secure_url} = await cloudinary.uploader.upload(image.path , {
                transformation : [
                    {
                        effect : 'background_removal',
                        background_removal : 'remove_the_background'
                    }
                ]
            })      



            await sql`INSERT INTO creations (user_id , prompt , content , type , publish)
            VALUES (${userId} , 'Remove background from image' , ${secure_url} , 'image' , true )`;

          
            res.json({success:true , content: secure_url})

        } catch (error) {
            console.log("removeImageBackground Error:", error);
            console.log("Error response:", error.response?.data || error.message);
            res.json({success:false , message : error.message})
        }
}


export const removeImageObject = async(req,res) => {
        try {
            const {userId} = req.auth();
            const {object} = req.body;
            const image = req.file;
            const plan = req.plan;
           
            
            if(plan !== 'premium' ) {
                return res.json({success:false , message : 'This feature is only available for premium subscriptions.'})
            }

          const {public_id} = await cloudinary.uploader.upload(image.path )
          
          const imageUrl =  cloudinary.url(public_id , {
            transformation : [{effect : `gen_remove:${object}`}],
            resource_type : 'image',
          })


        await sql`INSERT INTO creations (user_id , prompt , content , type)
        VALUES (${userId} , ${`Removed ${object} from image`} , ${imageUrl} , 'image')`;

          
            res.json({success:true , content: imageUrl})

        } catch (error) {
            console.log("removeImageObject Error:", error);
            console.log("Error response:", error.response?.data || error.message);
            res.json({success:false , message : error.message})
        }
}



export const resumeReview = async(req,res) => {
        try {
            const {userId} = req.auth();
            const resume = req.file;
            
            const plan = req.plan;
           
            
            if(plan !== 'premium' ) {
                return res.json({success:false , message : 'This feature is only available for premium subscriptions.'})
            }

            if(resume.size > 5 * 1024 * 1024) {
                return res.json({success:false , message : 'File size should be less than 5MB'})
            }

            const dataBuffer = fs.readFileSync(resume.path);
            const pdfData = await pdf(dataBuffer);

            const prompt = `Review the following resume and provide constructive
             feedback on its strengths , weakness, and areas for improvement.
             Resume Content :\n\n${pdfData.text}`

            const response = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }],
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000,
                },
            });

            const content = response.response.text();

        await sql`INSERT INTO creations (user_id , prompt , content , type)
        VALUES (${userId} ,'Review the uploaded resume' , ${content} , 'resume-review')`;

          
            res.json({success:true , content})

        } catch (error) {
            console.log("resumeReview Error:", error);
            console.log("Error response:", error.response?.data || error.message);
            res.json({success:false , message : error.message})
        }
}