"use client";
import { useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    console.log("File selected:", file);
    if (file) {
      processImage(file);
    } else {
      console.log("No file found in input");
    }
  };

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) {
      setError("No file detected");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    processImage(file);
  };

  const processImage = async (file: File) => {
    console.log("processImage called with:", file);
    console.log("File type:", file.type);
    console.log("File size:", file.size);
    console.log("File name:", file.name);

    setError(null);
    setIsProcessing(true);

    try {
      // 파일 크기 검증 (50MB 제한)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        const errorMsg = "File size must be less than 50MB";
        console.log(errorMsg);
        throw new Error(errorMsg);
      }

      // 파일 타입 검증
      if (!file.type.startsWith("image/")) {
        const errorMsg = "Please upload a valid image file";
        console.log(errorMsg);
        throw new Error(errorMsg);
      }

      console.log("Starting image processing with FileReader...");

      const reader = new FileReader();

      reader.onerror = (error) => {
        console.log("FileReader error:", error);
        setError("Failed to read file");
        setIsProcessing(false);
      };

      reader.onload = (e) => {
        console.log("FileReader onload triggered");

        try {
          const img = new Image();

          // 타임아웃 설정 (30초)
          const loadTimeout = setTimeout(() => {
            console.log("Image load timeout");
            setError("Image loading timed out. The file might be too large or corrupted.");
            setIsProcessing(false);
          }, 30000);

          img.onerror = (error) => {
            clearTimeout(loadTimeout);
            console.log("Image load error:", error);
            console.log("Image src preview:", img.src?.substring(0, 100));
            console.log("Attempting to identify issue...");

            // 파일 시그니처 확인
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (arrayBuffer) {
              const header = new Uint8Array(arrayBuffer.slice(0, 4));
              const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join('');
              console.log("File signature (hex):", headerHex);

              // PNG: 89 50 4E 47, JPEG: FF D8 FF
              const isPNG = headerHex.startsWith('89504e47');
              const isJPEG = headerHex.startsWith('ffd8ff');
              console.log("Is PNG:", isPNG, "Is JPEG:", isJPEG);

              if (!isPNG && !isJPEG) {
                setError("Invalid image file format. Only PNG and JPEG are supported.");
              } else {
                setError("Failed to decode image. The file might be corrupted.");
              }
            } else {
              setError("Failed to load image. Please try another file.");
            }
            setIsProcessing(false);
          };

          img.onload = () => {
            clearTimeout(loadTimeout);
            console.log("Image loaded successfully");
            console.log("Image dimensions:", img.width, "x", img.height);

            try {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");

              if (!ctx) {
                throw new Error("Failed to create canvas context");
              }

              const originalWidth = img.width;
              const originalHeight = img.height;
              const croppedHeight = Math.min(500, originalHeight);

              // 이미지 크기 검증
              if (originalWidth === 0 || originalHeight === 0) {
                throw new Error("Invalid image dimensions");
              }

              // Canvas 크기 제한 체크 (브라우저 제한)
              const maxCanvasSize = 16384; // 대부분 브라우저의 안전한 제한
              if (originalWidth > maxCanvasSize) {
                throw new Error(
                  `Image width (${originalWidth}px) exceeds maximum supported size (${maxCanvasSize}px)`
                );
              }

              // 메모리 체크 (픽셀 수 기준)
              const totalPixels = originalWidth * croppedHeight;
              const maxPixels = 268435456; // 16384 * 16384
              if (totalPixels > maxPixels) {
                throw new Error(
                  "Image is too large to process. Please use a smaller image."
                );
              }

              console.log(
                `Processing image: ${originalWidth}x${originalHeight}px, cropping to ${originalWidth}x${croppedHeight}px`
              );

              canvas.width = originalWidth;
              canvas.height = croppedHeight;

              // 상단 500px 크롭
              ctx.drawImage(
                img,
                0,
                0,
                originalWidth,
                croppedHeight,
                0,
                0,
                originalWidth,
                croppedHeight
              );

              // JPEG로 변환하여 Data URL 크기 줄이기
              console.log("Converting to Data URL...");
              const croppedDataURL = canvas.toDataURL("image/jpeg", 0.95);

              // Data URL 크기 체크
              const dataUrlSize = croppedDataURL.length;
              console.log(
                `Data URL size: ${(dataUrlSize / 1024 / 1024).toFixed(2)}MB`
              );

              console.log("Image processing complete!");
              setImageFile(croppedDataURL);
              setIsProcessing(false);
              setError(null);
            } catch (err) {
              console.log("Canvas processing error:", err);
              console.log(
                "Error stack:",
                err instanceof Error ? err.stack : "No stack"
              );
              setError(
                err instanceof Error ? err.message : "Failed to process image"
              );
              setIsProcessing(false);
            }
          };

          // ArrayBuffer를 Data URL로 변환
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const blob = new Blob([arrayBuffer], { type: file.type });
          const reader2 = new FileReader();

          reader2.onload = () => {
            console.log("Setting image src...");
            console.log("Data URL length:", (reader2.result as string)?.length);
            img.src = reader2.result as string;
          };

          reader2.onerror = () => {
            console.log("Failed to convert to Data URL");
            setError("Failed to process image file");
            setIsProcessing(false);
          };

          reader2.readAsDataURL(blob);
        } catch (err) {
          console.log("Image processing error:", err);
          console.log(
            "Error stack:",
            err instanceof Error ? err.stack : "No stack"
          );
          setError(
            err instanceof Error ? err.message : "Failed to process image"
          );
          setIsProcessing(false);
        }
      };

      console.log("Starting FileReader...");
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.log("Process image error:", err);
      console.log("Error stack:", err instanceof Error ? err.stack : "No stack");
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setImageFile(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const dismissError = () => {
    setError(null);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black px-4 py-12">
      <div className="max-w-3xl w-full space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-2"
        >
          <h1 className="text-5xl font-bold tracking-tight text-white">
            PercyLN Preview
          </h1>
        </motion.div>

        {/* Error Message */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-red-950/50 border border-red-900 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-red-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-red-200">{error}</p>
              </div>
              <button
                onClick={dismissError}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Preview */}
        <AnimatePresence mode="wait">
          {imageFile && (
            <motion.div
              key="image-preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex justify-center">
                <div className="rounded-lg p-3 border border-zinc-800 max-w-2xl">
                  <img
                    src={imageFile}
                    alt="preview"
                    className="max-w-full h-auto max-h-[500px] object-contain rounded"
                  />
                </div>
              </div>
              <div className="flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReset}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded border border-zinc-700 transition-colors"
                >
                  Reset
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Area */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <motion.div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            animate={{
              borderColor: isDragging ? "#52525b" : "#27272a",
            }}
            className="bg-zinc-950 border-2 border-dashed rounded-lg p-12 transition-colors"
          >
            <div className="flex flex-col items-center gap-6">
              {/* Upload Icon */}
              <motion.div
                animate={{
                  y: isDragging ? -4 : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800"
              >
                <svg
                  className="w-8 h-8 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </motion.div>

              {/* Upload Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUploadClick}
                disabled={isProcessing}
                className="px-6 py-3 bg-white hover:bg-zinc-200 text-black rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? "Processing..." : "Upload Image"}
              </motion.button>

              {/* Instructions */}
              <motion.p
                animate={{
                  color: isDragging ? "#a1a1aa" : "#71717a",
                }}
                className="text-sm text-center"
              >
                {isDragging ? (
                  <span>Drop your image here</span>
                ) : (
                  <span>
                    Click to upload or <span className="text-white">drag & drop</span>
                  </span>
                )}
              </motion.p>

              {/* File Requirements */}
              <p className="text-xs text-zinc-600 text-center">
                Max file size: 50MB · Supported: JPG, PNG, GIF, WebP
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center"
        >
        </motion.div>
      </div>

      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={inputRef}
        onChange={handleFileChange}
      />

      <Analytics />
    </main>
  );
}
