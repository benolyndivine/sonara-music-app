import React, { useState } from "react";
import { auth, db } from "./firebaseConfig"; // Adjust path to your firebase config
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { uploadToCloudinary } from "./cloudinaryService";

const HEAD_ADMIN_EMAIL = "YOUR_HEAD_ADMIN_EMAIL@gmail.com";

export default function AdminSongUploader() {
  const [songFile, setSongFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [details, setDetails] = useState({
    title: "",
    artist: "",
    album: "",
    genre: "",
  });

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const currentUser = auth.currentUser;
  const isHead = currentUser && currentUser.email === HEAD_ADMIN_EMAIL;

  // Enforce frontend access restriction
  if (!isHead) {
    return (
      <div style={{ padding: 20 }}>
        <h3>Access Denied</h3>
        <p>Only the head administrator ({HEAD_ADMIN_EMAIL}) can upload songs.</p>
      </div>
    );
  }

  const handleInputChange = (e) => {
    setDetails({ ...details, [e.target.name]: e.target.value });
  };

  const handleUploadAndSave = async (e) => {
    e.preventDefault();

    if (!songFile || !coverFile) {
      alert("Please select both a song file and a cover image.");
      return;
    }

    setLoading(true);
    setStatusMessage("Uploading media to Cloudinary...");

    try {
      // 1. Concurrent uploads to Cloudinary
      const [coverResult, audioResult] = await Promise.all([
        uploadToCloudinary(coverFile, "image"),
        uploadToCloudinary(songFile, "video"), // Cloudinary handles audio files under the 'video' endpoint
      ]);

      setStatusMessage("Saving song metadata to Firebase...");

      // 2. Add entry to Firestore 'songs' collection
      const songPayload = {
        title: details.title.trim(),
        artist: details.artist.trim(),
        album: details.album.trim(),
        genre: details.genre.trim(),
        audioUrl: audioResult.url,
        coverUrl: coverResult.url,
        duration: audioResult.duration || 0,
        uploadedBy: currentUser.email,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "songs"), songPayload);

      setStatusMessage("Song uploaded and saved to Firebase successfully!");

      // 3. Reset form
      setDetails({ title: "", artist: "", album: "", genre: "" });
      setSongFile(null);
      setCoverFile(null);
      e.target.reset();
    } catch (error) {
      console.error("Upload error:", error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "20px auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>Head Admin - Song Upload</h2>
      <form onSubmit={handleUploadAndSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label>Song Title *</label>
          <input
            type="text"
            name="title"
            value={details.title}
            onChange={handleInputChange}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div>
          <label>Artist Name *</label>
          <input
            type="text"
            name="artist"
            value={details.artist}
            onChange={handleInputChange}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div>
          <label>Album</label>
          <input
            type="text"
            name="album"
            value={details.album}
            onChange={handleInputChange}
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div>
          <label>Genre</label>
          <input
            type="text"
            name="genre"
            value={details.genre}
            onChange={handleInputChange}
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div>
          <label>Audio File (MP3, WAV, etc.) *</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setSongFile(e.target.files[0])}
            required
          />
        </div>

        <div>
          <label>Cover Image (JPG, PNG, WebP) *</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCoverFile(e.target.files[0])}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            backgroundColor: loading ? "#ccc" : "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Processing..." : "Upload & Save to Database"}
        </button>
      </form>

      {statusMessage && (
        <p style={{ marginTop: 15, fontWeight: "bold", textAlign: "center" }}>
          {statusMessage}
        </p>
      )}
    </div>
  );
}