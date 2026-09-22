import { GoogleGenAI } from "@google/genai";
import { aircraftList } from "../src/data/aircraft";
import fs from "fs";
import path from "path";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY environment variable. Cannot start generation.");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

const planesDir = path.join(process.cwd(), "public", "planes");
if (!fs.existsSync(planesDir)) {
  fs.mkdirSync(planesDir, { recursive: true });
}

const progressFilePath = path.join(process.cwd(), "public", "generation_progress.json");

// Define target specifications
const liverySpecs = `Role: Professional Designer for an Airline Management Game.
Task: Generate photorealistic images of valid passenger aircraft models based on user input. The absolute highest priority is to accurately depict exactly the specified aircraft model. Never use cargo variants.
Livery Specifications:
Empennage (Horizontal and Vertical Stabilizers) and rear fuselage are solid black.
The remaining fuselage is pure white with absolutely no text or additional markings.
Place a modern, yellow logo on the black vertical stabilizer consisting of a yellow circle containing the letters 'AMN'.
Landing gear must be retracted.
Composition:
Aspect Ratio: 3:2.
Setting: In-flight against a clear blue sky.
Perspective: Dynamic low-angle side-profile view, slightly from front and below.`;

async function run() {
  console.log("Starting production hangar line for all 263 aircraft models using gemini-2.5-flash-image...");

  let completed = 0;
  let skipped = 0;
  let failed = 0;
  const total = aircraftList.length;

  for (let i = 0; i < total; i++) {
    const plane = aircraftList[i];
    const imagePath = path.join(planesDir, `${plane.id}.png`);

    // Write initial or periodic progress to let the front-end or user inspect
    const progress = {
      completed,
      skipped,
      failed,
      total,
      percentage: Math.round(((completed + skipped + failed) / total) * 100),
      currentId: plane.id,
      currentName: `${plane.manufacturer} ${plane.type}`,
      isDone: false,
      estimatedTimeRemainingMinutes: Math.round(((total - (completed + skipped + failed)) * 2.5) / 60)
    };
    fs.writeFileSync(progressFilePath, JSON.stringify(progress, null, 2));

    if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 1000) {
      console.log(`[${i + 1}/${total}] Skipping existing file for ${plane.id}`);
      skipped++;
      continue;
    }

    const specificPrompt = `${liverySpecs}\n\nA commercial airplane: ${plane.manufacturer} ${plane.type} (${plane.family || ''})`;
    console.log(`[${i + 1}/${total}] Generating image for ${plane.manufacturer} ${plane.type}...`);

    let attempts = 0;
    let base64Image: string | null = null;
    let success = false;

    // Use multiple fallback models for ultimate robustness
    const modelsToTry = [
      'gemini-2.5-flash-image',
      'gemini-3.1-flash-image'
    ];

    for (const modelName of modelsToTry) {
      if (success) break;
      attempts = 0;
      while (attempts < 2 && !success) {
        try {
          attempts++;
          console.log(`Trying ${modelName} (Attempt ${attempts}/2) for ${plane.id}...`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [{ text: specificPrompt }],
            },
            config: {
              temperature: 0.25,
              imageConfig: {
                aspectRatio: "3:2",
              }
            }
          });

          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData && part.inlineData.data) {
                base64Image = part.inlineData.data;
                success = true;
                break;
              }
            }
          }

          if (!success) {
            throw new Error(`Response from ${modelName} did not contain inlineData image`);
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} failed on attempt ${attempts}: ${err.message || err}`);
          if (attempts < 2) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
    }

    if (success && base64Image) {
      try {
        const buffer = Buffer.from(base64Image, 'base64');
        fs.writeFileSync(imagePath, buffer);
        console.log(`Successfully generated and saved ${plane.id}.png`);
        completed++;
      } catch (writeErr: any) {
        console.error(`Error saving image for ${plane.id}:`, writeErr);
        failed++;
      }
    } else {
      console.error(`Failed to generate image for ${plane.id} after trying all fallback models`);
      failed++;
    }

    // Delay 2.5 seconds between requests to maintain rate limits
    await new Promise(r => setTimeout(r, 2500));
  }

  // Create final progress output
  const finalProgress = {
    completed,
    skipped,
    failed,
    total,
    percentage: 100,
    currentId: null,
    currentName: null,
    isDone: true,
    estimatedTimeRemainingMinutes: 0
  };
  fs.writeFileSync(progressFilePath, JSON.stringify(finalProgress, null, 2));
  console.log("Image generation production run complete!");
}

run().catch(err => {
  console.error("Critical error in generation loop:", err);
});
