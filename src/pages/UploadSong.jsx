import React, { useState } from "react";
import { auth, db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { uploadToCloudinary } from "../services/cloudinaryService";
import { useNavigate } from "react-router-dom";

const HEAD_ADMIN_EMAIL = "benolynd@gmail.com";

export default function UploadSong() {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [songFile, setSongFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [targetCollection, setTargetCollection] = useState("songs");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Check if current user is the head admin
  if (!currentUser || currentUser.email !== HEAD_ADMIN_EMAIL) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#fff" }}>
        <h2>Access Denied</h2>
        <p>Only the Head Admin ({HEAD_ADMIN_EMAIL}) can access this upload page.</p>
        <button onClick={() => navigate(-1)} style={btnStyle}>Go Back</button>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!songFile || !coverFile) {
      alert("Please select both a song file and a cover image.");
      return;
    }

    setLoading(true);
    setStatus("Uploading files to Cloudinary...");

    try {
      // 1. Parallel upload to Cloudinary using music_app_preset
      const [coverUrl, songUrl] = await Promise.all([
        uploadToCloudinary(coverFile, "image"),
        uploadToCloudinary(songFile, "video"), // Cloudinary handles audio files under video/auto
      ]);

      setStatus("Saving song details to Firebase...");

      // 2. Add document to Firestore
      const songData = {
        title: title.trim(),
        artist: artist.trim(),
        cover: coverUrl,
        songUrl: songUrl,
        uploadedBy: currentUser.email,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, targetCollection), songData);

      setStatus("Song successfully uploaded and published!");
      setTitle("");
      setArtist("");
      setSongFile(null);
      setCoverFile(null);
      e.target.reset();
    } catch (err) {
      console.error(err);
      setStatus(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <button onClick={() => navigate(-1)} style={backBtnStyle}>← Back to Profile</button>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>Upload New Song</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        <div>
          <label style={labelStyle}>Song Title *</label>
          <input 
            type="text" 
            placeholder="Enter song title"
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Artist Name *</label>
          <input 
            type="text" 
            placeholder="Enter artist name"
            value={artist} 
            onChange={(e) => setArtist(e.target.value)} 
            required 
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Category / Collection</label>
          <select 
            value={targetCollection} 
            onChange={(e) => setTargetCollection(e.target.value)} 
            style={inputStyle}
          >
            <option value="songs">General Songs (/songs)</option>
            <option value="christianSongs">Christian Songs (/christianSongs)</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Song File (Audio) *</label>
          <input 
            type="file" 
            accept="audio/*" 
            onChange={(e) => setSongFile(e.target.files[0])} 
            required 
            style={fileInputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Cover Art (Image) *</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setCoverFile(e.target.files[0])} 
            required 
            style={fileInputStyle}
          />
        </div>

        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? "Uploading to Cloudinary & Firebase..." : "Upload & Save Song"}
        </button>
      </form>

      {status && <p style={{ marginTop: 15, textAlign: "center", color: "#1db954" }}>{status}</p>}
    </div>
  );
}

// Inline Styles
const containerStyle = {
  maxWidth: 500,
  margin: "30px auto",
  padding: "24px",
  backgroundColor: "#181818",
  color: "#fff",
  borderRadius: "10px",
  boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
};

const labelStyle = { display: "block", marginBottom: 6, fontSize: 14, fontWeight: "500" };
const inputStyle = { width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #333", backgroundColor: "#282828", color: "#fff", boxSizing: "border-box" };
const fileInputStyle = { width: "100%", padding: "8px", color: "#aaa" };
const btnStyle = { padding: "12px", backgroundColor: "#1db954", color: "#fff", border: "none", borderRadius: 6, fontWeight: "bold", cursor: "pointer" };
const backBtnStyle = { background: "none", border: "none", color: "#aaa", cursor: "pointer", marginBottom: 15 };