import { Router } from "express";

const router = Router();

router.get("/hero", async (req, res): Promise<void> => {
  const destination = String(req.query.destination ?? "").trim();

  if (!destination) {
    res.status(400).json({
      error: "Destination is required",
    });
    return;
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        `${destination} travel landscape`
      )}&orientation=landscape&per_page=1`,
      {
        headers: {
          Authorization: process.env.PEXELS_API_KEY ?? "",
        },
      }
    );

    type PexelsResponse = {
      photos?: {
        src: {
          large2x: string;
        };
      }[];
    };

    const data = (await response.json()) as PexelsResponse;

    if (!data.photos || data.photos.length === 0) {
      res.json({ image: null });
      return;
    }

    res.json({
      image: data.photos[0].src.large2x,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch hero image",
    });
  }
});

export default router;