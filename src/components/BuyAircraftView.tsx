import React, { useMemo, useState, useEffect } from 'react';
import { aircraftList, Aircraft } from '../data/aircraft';
import { Plane, ChevronDown, ChevronRight, Info, Search, UploadCloud, CheckCircle2, AlertCircle, Archive, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { getExternalImageBaseUrl, setSupabaseBucketUrl, getSupabaseBucketUrl } from '../lib/imageUtils';
import { AircraftImage } from './AircraftImage';
import { SupabaseBucketModal } from './SupabaseBucketModal';

interface Props {
  currentDateOffset: number;
  onSelectAircraft: (aircraft: Aircraft) => void;
  /** Passed down from App, which already owns this as state. */
  debugMode?: boolean;
}

export function BuyAircraftView({ currentDateOffset, onSelectAircraft, debugMode: debugModeProp }: Props) {
  const [expandedMfgs, setExpandedMfgs] = useState<Set<string>>(new Set());
  const [expandedPlaneId, setExpandedPlaneId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Falls back to storage only when the prop is absent. This used to poll
  // localStorage every 500 ms for a value that already lives in App's state.
  const debugMode = debugModeProp ?? (typeof window !== 'undefined' && localStorage.getItem('airline_debug_mode') === 'true');

  // ZIP upload state
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    extractedCount: number;
    matchedPlanesCount: number;
    error?: string;
  } | null>(null);

  // ZIP URL fetch state
  const [zipUrl, setZipUrl] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);

  const handleZipUrlSubmit = async () => {
    if (!zipUrl) return;
    setFetchingUrl(true);
    setUploadResult(null);
    try {
      const response = await fetch("/api/fetch-images-zip-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: zipUrl })
      });
      const data = await response.json();
      
      if (data.success) {
        setUploadResult({
          success: true,
          extractedCount: data.extractedFiles || 0,
          matchedPlanesCount: data.matchedPlanesCount || 0
        });
        fetchImagesMap();
      } else {
        setUploadResult({
          success: false,
          extractedCount: 0,
          matchedPlanesCount: 0,
          error: data.error || "Unerwarteter Fehler beim Herunterladen."
        });
      }
    } catch (e: any) {
      setUploadResult({
        success: false,
        extractedCount: 0,
        matchedPlanesCount: 0,
        error: e.message || "Netzwerkfehler"
      });
    } finally {
      setFetchingUrl(false);
    }
  };

  // Single JPG/PNG image upload state
  const [singleSearchTerm, setSingleSearchTerm] = useState("");
  const [onlyMissingImages, setOnlyMissingImages] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [singleImageFile, setSingleImageFile] = useState<File | null>(null);
  const [singleUploading, setSingleUploading] = useState(false);
  const [singleUploadResult, setSingleUploadResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Dynamic images map from API
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});

  const fetchImagesMap = () => {
    fetch('/api/aircraft-images')
      .then(res => res.json())
      .then(data => setImagesMap(data))
      .catch(err => console.error("Error loading images map:", err));
  };

  useEffect(() => {
    fetchImagesMap();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setUploadResult({
        success: false,
        extractedCount: 0,
        matchedPlanesCount: 0,
        error: "Please upload a valid .zip file containing aircraft images."
      });
      return;
    }

    // Checking max file size limit of 30MB due to Google Cloud Run physical container ingress limits
    const maxSizeBytes = 30 * 1024 * 1024; // 30 MB
    if (file.size > maxSizeBytes) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setUploadResult({
        success: false,
        extractedCount: 0,
        matchedPlanesCount: 0,
        error: `Die hochgeladene ZIP-Datei ist zu groß (${fileSizeMB} MB). Das Cloud-Hosting (Google Cloud Run) begrenzt Uploads auf maximal 30 MB pro Anfrage. Bitte verkleinere deine ZIP-Datei (z. B. durch Komprimierung der Bilder als JPG/WebP) oder lade sie in kleineren Teilen hoch.`
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload-images-zip", {
        method: "POST",
        body: formData,
      });

      // Gracefully inspect Response headers and status prior to parsing JSON
      if (!response.ok) {
        let errMessage = `Server-Fehler ${response.status}: ${response.statusText}`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await response.json();
            errMessage = errData.error || errMessage;
          } else {
            const textContent = await response.text();
            if (textContent.includes("413") || textContent.toLowerCase().includes("too large")) {
              errMessage = "The ZIP file is too large for the server. Please shrink it and upload again.";
            } else {
              errMessage = `Der Server antwortete mit einem nicht-JSON Format (${response.status}). Möglicherweise ist die ZIP-Datei zu groß oder beschädigt.`;
            }
          }
        } catch (innerErr) {
          console.error("Error reading fallback error details:", innerErr);
        }
        
        setUploadResult({
          success: false,
          extractedCount: 0,
          matchedPlanesCount: 0,
          error: errMessage
        });
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textContent = await response.text();
        let fallbackMsg = "Unexpected response from the server (expected JSON, received HTML).";
        if (textContent.includes("413") || textContent.toLowerCase().includes("too large")) {
          fallbackMsg = "The ZIP file exceeds the server's size limit. Please compress or shrink it.";
        }
        setUploadResult({
          success: false,
          extractedCount: 0,
          matchedPlanesCount: 0,
          error: fallbackMsg
        });
        return;
      }

      const data = await response.json();
      if (data.success) {
        setUploadResult({
          success: true,
          extractedCount: data.extractedFiles,
          matchedPlanesCount: data.matchedPlanesCount,
        });
        // Reload images immediately in real-time!
        fetchImagesMap();
      } else {
        setUploadResult({
          success: false,
          extractedCount: 0,
          matchedPlanesCount: 0,
          error: data.error || "Unerwarteter Fehler beim Extrahieren der ZIP-Datei."
        });
      }
    } catch (err: any) {
      setUploadResult({
        success: false,
        extractedCount: 0,
        matchedPlanesCount: 0,
        error: err.message || "Netzwerkfehler beim Hochladen des ZIP-Archivs."
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processSingleFile = async (file: File) => {
    if (!file) return;
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
      setSingleUploadResult({
        success: false,
        error: "Erlaubt sind nur Bilddateien (.png, .jpg, .jpeg, .webp, .svg)."
      });
      return;
    }
    setSingleImageFile(file);
    setSingleUploadResult(null);
  };

  const handleSingleUpload = async () => {
    if (!selectedAircraft) {
      setSingleUploadResult({ success: false, error: "Select an aircraft model first." });
      return;
    }
    if (!singleImageFile) {
      setSingleUploadResult({ success: false, error: "Select an image to upload first." });
      return;
    }

    setSingleUploading(true);
    setSingleUploadResult(null);

    const safeName = (selectedAircraft.manufacturer + ' ' + selectedAircraft.type).split('/').join('-').split('\\').join('-');
    const formData = new FormData();
    formData.append("file", singleImageFile);
    formData.append("aircraftSafeName", safeName);

    try {
      const response = await fetch("/api/upload-single-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errMessage = "Fehler beim Hochladen.";
        try {
          const data = await response.json();
          errMessage = data.error || errMessage;
        } catch {
          errMessage = `Server meldet Status ${response.status}`;
        }
        setSingleUploadResult({ success: false, error: errMessage });
        return;
      }

      const resData = await response.json();
      if (resData.success) {
        setSingleUploadResult({
          success: true,
          message: `Bild für ${selectedAircraft.manufacturer} ${selectedAircraft.type} wurde erfolgreich hochgeladen und dauerhaft ersetzt!`
        });
        setSingleImageFile(null);
        // Reload map right away
        fetchImagesMap();
      } else {
        setSingleUploadResult({ success: false, error: resData.error || "Unerwarteter Fehler." });
      }
    } catch (err: any) {
      setSingleUploadResult({ success: false, error: err.message || "Netzwerkfehler beim Hochladen." });
    } finally {
      setSingleUploading(false);
    }
  };

  const availableAircraft = useMemo(() => {
    return aircraftList.filter(a => {
      // Show everything in debugMode regardless of era
      if (!debugMode) {
        // Must have started delivery
        if (a.firstDeliveryOffset > currentDateOffset) return false;
        // Must not have ended delivery (or lastDelivery is null)
        if (a.lastDeliveryOffset !== null && a.lastDeliveryOffset < currentDateOffset) return false;
      }
      
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        if (
          !a.type.toLowerCase().includes(lowerSearch) &&
          !a.manufacturer.toLowerCase().includes(lowerSearch) &&
          !a.family.toLowerCase().includes(lowerSearch)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [currentDateOffset, searchTerm, debugMode]);

  // Group by manufacturer and family
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Aircraft[]>>();
    for (const a of availableAircraft) {
      if (!map.has(a.manufacturer)) map.set(a.manufacturer, new Map());
      const families = map.get(a.manufacturer)!;
      if (!families.has(a.family)) families.set(a.family, []);
      families.get(a.family)!.push(a);
    }
    return map;
  }, [availableAircraft]);

  const singleImageFilteredAircraft = useMemo(() => {
    return aircraftList.filter(a => {
      const fullName = (a.manufacturer + ' ' + a.type).toLowerCase();
      const matchSearch = !singleSearchTerm || fullName.includes(singleSearchTerm.toLowerCase()) || a.family.toLowerCase().includes(singleSearchTerm.toLowerCase());
      if (!matchSearch) return false;
      
      if (onlyMissingImages) {
        const safeName = (a.manufacturer + ' ' + a.type).split('/').join('-').split('\\').join('-');
        // Check if there is already an uploaded custom image in the imagesMap
        const hasCustomImage = !!imagesMap[safeName];
        if (hasCustomImage) return false;
      }
      return true;
    });
  }, [singleSearchTerm, onlyMissingImages, imagesMap]);

  const manufacturers: string[] = Array.from<string>(grouped.keys()).sort();

  const toggleMfg = (mfg: string) => {
    setExpandedMfgs(prev => {
      const next = new Set(prev);
      if (next.has(mfg)) next.delete(mfg);
      else next.add(mfg);
      return next;
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const generateSummary = (plane: Aircraft) => {
    return (
      <div className="flex flex-col gap-2">
        <p>The <strong>{plane.manufacturer} {plane.type}</strong> is widely recognized in the aviation industry for its distinct operational capabilities within the {plane.class.toLowerCase()} segment. Developed as a key member of the {plane.family} family, it addresses airline demands for efficient routing and optimal passenger loads.</p>
        <p>This model is capable of flying up to {plane.maxRange} km at a cruise speed of {plane.cruiseSpeed} km/h, equipped to comfortably carry {plane.capacity} passengers in a standard configuration. With an efficiency rating of {plane.efficiency}/100, it remains a competitive choice for modern fleets aiming to balance op-ex with passenger satisfaction ({plane.popularity}%).</p>
        <a 
          href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(plane.manufacturer + ' ' + plane.type)}`} 
          target="_blank" 
          rel="noreferrer"
          className="text-aero-yellow hover:underline mt-2 inline-flex items-center gap-1"
        >
          Research on Wikipedia ↗
        </a>
      </div>
    );
  };

  return (
    <div className="w-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 flex flex-col font-sans h-full overflow-hidden">
      <div className="flex items-center justify-between shrink-0 mb-3">
        <h2 className="text-3xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg">
          BUY AIRCRAFT
        </h2>
        <div className="relative w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-white/40" />
          </div>
          <input
            type="text"
            className="w-full bg-black/40 border border-white/10 rounded-sm py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-aero-yellow/50 font-mono transition-colors"
            placeholder="Search Type, Manufacturer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-0 pr-4 custom-scrollbar space-y-6 pb-20">
        {/* Permanent Supabase Storage Bucket Settings */}
        {debugMode && (
          <div className="bg-[#0f0f0f] border border-aero-yellow/20 rounded-sm p-4 shrink-0 transition-all hover:border-aero-yellow/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold font-mono uppercase tracking-[0.2em] text-aero-yellow flex items-center gap-2">
                  <Database size={16} />
                  Supabase Storage Bucket (Permanent Images)
                </h3>
                <p className="text-xs text-white/60 font-mono mt-0.5">
                  Connected Supabase storage bucket URL for permanent aircraft image rendering across all devices.
                </p>
              </div>
              {getSupabaseBucketUrl() && (
                <div className="flex items-center gap-1.5 bg-aero-yellow/10 border border-aero-yellow/20 px-2.5 py-1 rounded-sm text-2xs font-mono text-aero-yellow font-bold uppercase tracking-wider self-start sm:self-center shrink-0">
                  <CheckCircle2 size={12} />
                  Bucket Active
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="e.g. https://xxxx.supabase.co/storage/v1/object/public/your-bucket-name"
                className="flex-1 bg-black/60 border border-white/10 rounded-sm px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-aero-yellow/60 transition-colors placeholder:text-white/20"
                value={getSupabaseBucketUrl()}
                onChange={(e) => {
                  setSupabaseBucketUrl(e.target.value);
                  setSearchTerm(prev => prev); // re-trigger render
                }}
              />
              <button
                type="button"
                className="bg-white/5 hover:bg-white/10 text-white font-mono text-xs px-4 py-2 border border-white/10 rounded-sm transition-colors whitespace-nowrap"
                onClick={() => {
                  setSupabaseBucketUrl('');
                  setSearchTerm(prev => prev);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}
        {/* Sleek ZIP & Single Image Customizers - visible in debug mode */}
        {debugMode && (
          <>

          <div className="bg-[#0f0f0f] border border-white/5 rounded-sm p-4 shrink-0 transition-all hover:border-white/10 space-y-6">
            
            {/* Part 1: ZIP Archive Uploader */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-sm font-bold font-mono uppercase tracking-[0.2em] text-aero-yellow flex items-center gap-2">
                    <Archive size={16} />
                    Planes Image ZIP customizer (SAT APPROVED)
                  </h3>
                  <p className="text-xs text-white/40 font-mono mt-0.5">
                    Lade ein ZIP-Archiv mit passenden Flugzeugbildern (.png, .jpg, .webp) hoch. Diese werden automatisch den richtigen Ordnern zugeordnet.
                  </p>
                </div>
                
                <button 
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('zip-file-input');
                    if (el) el.click();
                  }}
                  className="self-start sm:self-center bg-aero-yellow text-black font-mono font-bold uppercase tracking-widest text-2xs px-4 py-2 hover:bg-white transition-all transform hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                  disabled={uploading}
                >
                  {uploading ? "Wird verarbeitet..." : "ZIP DATEI HOCHLADEN"}
                </button>
              </div>

              {/* Drag & Drop Area */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-sm p-4 flex flex-col items-center justify-center transition-all ${
                  dragActive ? "border-aero-yellow bg-aero-yellow/5" : "border-white/5 bg-black/20 hover:border-white/10"
                }`}
              >
                <input
                  id="zip-file-input"
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleFileInput}
                  disabled={uploading}
                />
                
                <UploadCloud size={32} className={`mb-2 transition-colors ${dragActive ? 'text-aero-yellow' : 'text-white/20'}`} />
                
                <p className="text-xs font-mono text-white/50 text-center">
                  {uploading ? (
                    <span className="text-aero-yellow animate-pulse">ZIP-Datei wird analysiert und extrahiert... Bitte warten.</span>
                  ) : (
                    <span>Zieh deine Bilder-.zip-Datei hierher oder <span className="text-aero-yellow font-bold cursor-pointer underline">klicke zum Durchsuchen</span></span>
                  )}
                </p>
              </div>

              {/* URL Fetching Area */}
              <div className="mt-3 bg-black/20 p-3 border border-white/5 rounded-sm">
                <div className="text-2xs font-mono uppercase tracking-widest text-white/40 font-bold mb-2">Or load a ZIP straight from a link (e.g. Google Drive)</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="https://drive.google.com/file/d/.../view"
                    className="flex-1 bg-black/50 border border-white/10 rounded-sm px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-aero-yellow/50 placeholder:text-white/20"
                    value={zipUrl}
                    onChange={e => setZipUrl(e.target.value)}
                    disabled={fetchingUrl}
                  />
                  <button
                    type="button"
                    className="bg-white/5 hover:bg-white/10 text-white font-mono text-xs px-4 py-2 border border-white/10 rounded-sm transition-colors whitespace-nowrap disabled:opacity-50"
                    onClick={handleZipUrlSubmit}
                    disabled={!zipUrl || fetchingUrl}
                  >
                    {fetchingUrl ? "Loading..." : "Aus URL laden"}
                  </button>
                </div>
              </div>

              {/* Results Feedback */}
              {uploadResult && (
                <div className={`mt-3 p-3 rounded-sm border font-mono text-xs flex items-start gap-2.5 ${
                  uploadResult.success 
                    ? "bg-[#0b1c0e] text-aero-yellow border-aero-yellow/20 animate-fade-in" 
                    : "bg-[#250d0d] text-aero-yellow/60 border-white/20 animate-fade-in"
                }`}>
                  {uploadResult.success ? (
                    <>
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-aero-yellow" />
                      <div>
                        <div className="font-bold uppercase tracking-wider">ZIP-EXTRAKTION ERFOLGREICH</div>
                        <div className="mt-1 leading-relaxed">
                          Insgesamt wurden <strong className="text-white">{uploadResult.extractedCount} Bilder</strong> extrahiert und <strong className="text-white">{uploadResult.matchedPlanesCount} verschiedenen Flugzeugmodellen</strong> dauerhaft zugeordnet!
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-aero-yellow/60" />
                      <div>
                        <div className="font-bold uppercase tracking-wider">FEHLER BEI EXTRAKTION</div>
                        <div className="mt-1 leading-relaxed">{uploadResult.error}</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Elegant separation line */}
            <div className="h-px bg-white/5 my-5" />

            {/* Part 2: Dynamic Single Image Search, Filter and Direct Uploader */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold font-mono uppercase tracking-[0.2em] text-aero-yellow flex items-center gap-2">
                  <Plane size={16} />
                  Single Aircraft Image Uploader (SAT APPROVED)
                </h3>
                <p className="text-xs text-white/40 font-mono mt-0.5">
                  Suche nach bestimmten Flugzeugtypen, filtere nach Modellen ohne Bilder, und lade direkt ein einzelnes Bild hoch. Alte Bilder werden dabei automatisch durch das neueste ersetzt.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {/* Left Column: Filter and select aircraft type */}
                <div className="flex flex-col min-w-0">
                  <div className="flex flex-col gap-2 mb-2">
                    <span className="text-2xs font-mono uppercase tracking-widest text-white/40 font-bold">1. Select or search for a model</span>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {/* Search tool block */}
                      <div className="relative flex-1">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          type="text"
                          className="w-full bg-black/50 border border-white/5 rounded-sm py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-aero-yellow/40 font-mono"
                          placeholder="Modell suchen (z.B. A320)..."
                          value={singleSearchTerm}
                          onChange={(e) => setSingleSearchTerm(e.target.value)}
                        />
                      </div>

                      {/* Toggle button */}
                      <button
                        type="button"
                        onClick={() => setOnlyMissingImages(!onlyMissingImages)}
                        className={`px-3 py-1.5 text-2xs font-mono uppercase border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          onlyMissingImages 
                            ? "bg-aero-yellow/10 border-aero-yellow text-aero-yellow font-bold" 
                            : "bg-black/40 border-white/5 text-white/50 hover:text-white"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${onlyMissingImages ? "bg-aero-yellow animate-pulse" : "bg-white/20"}`} />
                        OOhne Bild filtern
                      </button>
                    </div>
                  </div>

                  {/* Scrollable container with unique ID */}
                  <div 
                    id="aircraft-debug-picker-list"
                    className="border border-white/5 bg-black/50 rounded-sm max-h-48 overflow-y-auto custom-scrollbar font-mono text-xs divide-y divide-white/5"
                  >
                    {singleImageFilteredAircraft.length === 0 ? (
                      <div className="p-4 text-center text-white/30 uppercase tracking-widest text-2xs">Keine entsprechenden Modelle gefunden</div>
                    ) : (
                      singleImageFilteredAircraft.map(a => {
                        const safeName = (a.manufacturer + ' ' + a.type).split('/').join('-').split('\\').join('-');
                        const isSelected = selectedAircraft?.id === a.id;
                        const hasCustom = !!imagesMap[safeName];
                        return (
                          <div
                            key={a.id}
                            onClick={() => {
                              setSelectedAircraft(a);
                              setSingleImageFile(null);
                              setSingleUploadResult(null);
                            }}
                            className={`p-2 flex items-center justify-between cursor-pointer transition-all ${
                              isSelected 
                                ? "bg-aero-yellow/5 border-l-2 border-aero-yellow text-aero-yellow font-bold" 
                                : "hover:bg-white/5 text-white/70"
                            }`}
                          >
                            <span className="truncate pr-1">{a.manufacturer} {a.type}</span>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className="text-3xs text-white/30 truncate max-w-[80px]">{a.family}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${hasCustom ? "bg-aero-yellow/20" : "bg-yellow-500"}`} title={hasCustom ? "Hat Bild" : "Kein Bild"} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-1 text-3xs font-mono text-white/30 flex justify-between">
                    <span>{singleImageFilteredAircraft.length} Modelle gefunden</span>
                    <span>{Object.keys(imagesMap).length} hochgeladene Bilder gesamt</span>
                  </div>
                </div>

                {/* Right Column: Upload action box */}
                <div className="flex flex-col justify-between min-w-0">
                  <div className="space-y-2">
                    <span className="text-2xs font-mono uppercase tracking-widest text-white/40 font-bold block">2. Choose an image and upload</span>
                    
                    {selectedAircraft ? (
                      <div className="bg-black/40 border border-white/5 rounded-sm p-3 font-mono text-xs text-white/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-3xs text-aero-yellow uppercase tracking-wider font-bold">Selected model:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAircraft(null);
                              setSingleImageFile(null);
                              setSingleUploadResult(null);
                            }}
                            className="text-white/40 hover:text-aero-yellow/60 text-3xs uppercase cursor-pointer"
                          >
                            [Abbrechen]
                          </button>
                        </div>
                        <div className="font-bold text-xs text-white uppercase tracking-wider bg-white/5 p-1.5 rounded-sm truncate">
                          {selectedAircraft.manufacturer} {selectedAircraft.type}
                        </div>
                        
                        {/* Area triggers local upload picker */}
                        <div 
                          id="single-image-drag-area"
                          onClick={() => {
                            const el = document.getElementById('single-image-file-input');
                            if (el) el.click();
                          }}
                          className="border border-dashed border-white/10 hover:border-aero-yellow/40 rounded-sm p-3 flex flex-col items-center justify-center cursor-pointer bg-black/50 transition-colors"
                        >
                          <input
                            id="single-image-file-input"
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.svg"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                processSingleFile(e.target.files[0]);
                              }
                            }}
                          />
                          {singleImageFile ? (
                            <div className="text-center">
                              <span className="text-aero-yellow font-bold block truncate max-w-[200px]" title={singleImageFile.name}>
                                {singleImageFile.name}
                              </span>
                              <span className="text-3xs text-white/40 block mt-0.5">
                                {(singleImageFile.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          ) : (
                            <div className="text-center text-white/40 space-y-1 py-1">
                              <UploadCloud size={18} className="mx-auto text-white/20" />
                              <span className="text-2xs block text-aero-yellow font-bold underline">Choose image file</span>
                              <span className="text-4xs block">PNG, JPG, WEBP oder SVG</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-white/5 bg-black/20 rounded-sm py-4 px-4 text-center text-white/30 font-mono text-xs flex flex-col items-center justify-center h-[122px]">
                        <Plane size={20} className="mb-1.5 text-white/10 animate-pulse" />
                        <span>Pick an aircraft model on the left to set its image (this replaces any existing one).</span>
                      </div>
                    )}
                  </div>

                  {/* Buttons and Result logs */}
                  <div className="mt-3 space-y-2">
                    {selectedAircraft && singleImageFile && (
                      <button
                        type="button"
                        onClick={handleSingleUpload}
                        className="w-full bg-aero-yellow text-black font-mono font-bold uppercase tracking-widest text-2xs py-2 px-3 hover:bg-white transition-all transform hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                        disabled={singleUploading}
                      >
                        {singleUploading ? "BILD WIRD HOCHGELADEN..." : "BILD HOCHLADEN & ERSETZEN"}
                      </button>
                    )}

                    {singleUploadResult && (
                      <div className={`p-2.5 rounded-sm border font-mono text-2xs flex items-start gap-2 ${
                        singleUploadResult.success 
                          ? "bg-[#0b1c0e] text-aero-yellow border-aero-yellow/20 animate-fade-in" 
                          : "bg-[#250d0d] text-aero-yellow/60 border-white/20 animate-fade-in"
                      }`}>
                        {singleUploadResult.success ? (
                          <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-aero-yellow" />
                        ) : (
                          <AlertCircle size={12} className="shrink-0 mt-0.5 text-aero-yellow/60" />
                        )}
                        <div>
                          <span className="font-bold uppercase block">{singleUploadResult.success ? "SATISFACTION COMPLETE" : "FEHLER"}</span>
                          <span className="leading-relaxed block mt-0.5">{singleUploadResult.success ? singleUploadResult.message : singleUploadResult.error}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
          </>
        )}

        {manufacturers.length === 0 ? (
          <div className="text-white/50 text-center uppercase tracking-widest mt-12 w-full">NO AIRCRAFT AVAILABLE IN THIS ERA.</div>
        ) : manufacturers.map(mfg => {
          const familiesMap = grouped.get(mfg)!;
          const families = Array.from(familiesMap.keys()).sort();
          const isExpanded = expandedMfgs.has(mfg);
          
          return (
            <div key={mfg} className="flex flex-col bg-black/40 border border-white/5 rounded-sm overflow-hidden shrink-0">
              <button 
                onClick={() => toggleMfg(mfg)} 
                className={`flex items-center gap-3 p-4 px-3 w-full text-left transition-colors ${isExpanded ? 'bg-white/5 border-b border-white/10 text-aero-yellow' : 'hover:bg-white/5 hover:text-white text-white/80'}`}
              >
                {isExpanded ? <ChevronDown size={24} /> : <ChevronRight size={24} className="opacity-50" />}
                <span className="text-2xl font-black uppercase tracking-widest leading-none">{mfg}</span>
                <span className="ml-auto text-xs font-mono opacity-50 tracking-widest">{familiesMap.size} Families</span>
              </button>
              
              {isExpanded && (
                <div className="flex flex-col gap-10 p-4 bg-gradient-to-b from-white/[0.02] to-transparent">
                  {families.map(fam => {
                    const planes = familiesMap.get(fam)!;
                    return (
                      <div key={fam} className="flex flex-col gap-4">
                        <h4 className="text-lg text-aero-yellow/70 font-bold tracking-[0.2em] uppercase border-b border-white/5 pb-2">{fam}</h4>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {planes.map(plane => {
                            const imageName = (plane.manufacturer + ' ' + plane.type).split('/').join('-').split('\\').join('-');
                            return (
                              <div key={plane.id} className="bg-[#0f0f0f] border border-white/10 rounded-sm p-4 flex flex-col sm:flex-row gap-3 hover:border-aero-yellow/50 transition-colors group relative overflow-hidden">
                                {/* Aircraft Tech Drawing Blueprint Graphic */}
                                <div className={`shrink-0 bg-black/40 rounded border border-white/5 overflow-hidden flex items-center justify-center relative transition-all duration-300 ${expandedPlaneId === plane.id ? 'w-full sm:w-64 aspect-square' : 'w-full sm:w-48 aspect-square'}`}>
                                  <AircraftImage
                                    safeName={imageName}
                                    manufacturer={plane.manufacturer}
                                    type={plane.type}
                                    imagesMap={imagesMap}
                                    className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-[1.03] transition-all duration-500"
                                  />
                                </div>

                                <div className="flex-1 flex flex-col min-w-0">
                                <div className="flex justify-between items-start mb-2">
                                  <h5 
                                    className="font-bold text-xl uppercase tracking-wide cursor-pointer hover:text-aero-yellow flex items-center gap-2 transition-colors truncate"
                                    onClick={() => setExpandedPlaneId(expandedPlaneId === plane.id ? null : plane.id)}
                                    title="Click to view details"
                                  >
                                    <span className="truncate">{plane.type}</span>
                                    <Info size={16} className={`shrink-0 transition-colors ${expandedPlaneId === plane.id ? 'text-aero-yellow' : 'text-white/30'}`} />
                                  </h5>
                                  <div className="text-xs border border-aero-yellow/20 text-aero-yellow/80 px-2 py-0.5 rounded-sm uppercase tracking-widest bg-aero-yellow/5 shrink-0 ml-2 whitespace-nowrap">{plane.class}</div>
                                </div>

                                {expandedPlaneId === plane.id && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 text-xs font-mono text-white/50 leading-relaxed bg-black/40 p-3 rounded-sm border border-white/10">
                                    {generateSummary(plane)}
                                  </motion.div>
                                )}

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-4 text-xs font-mono text-white/50 mb-4">
                                  <div className="flex flex-col border-b border-white/5 pb-1"><span className="text-3xs uppercase tracking-widest mb-1 opacity-70">PLANE TYPE SAT</span><span className="text-white font-bold">{plane.popularity}%</span></div>
                                  <div className="flex flex-col border-b border-white/5 pb-1"><span className="text-3xs uppercase tracking-widest mb-1 opacity-70">Efficiency</span><span className="text-white font-bold">{plane.efficiency}/100</span></div>
                                  <div className="flex flex-col border-b border-white/5 pb-1"><span className="text-3xs uppercase tracking-widest mb-1 opacity-70">Max Range</span><span className="text-white font-bold">{plane.maxRange} km</span></div>
                                  <div className="flex flex-col border-b border-white/5 pb-1"><span className="text-3xs uppercase tracking-widest mb-1 opacity-70">Capacity</span><span className="text-white font-bold">{plane.capacity} pax</span></div>
                                  <div className="flex flex-col border-b border-white/5 pb-1"><span className="text-3xs uppercase tracking-widest mb-1 opacity-70">Cruise Speed</span><span className="text-white font-bold">{plane.cruiseSpeed} km/h</span></div>
                                  <div className="flex flex-col border-b border-white/5 pb-1"><span className="text-3xs uppercase tracking-widest mb-1 opacity-70">Base Price</span><span className="text-aero-yellow font-bold tracking-widest">{formatCurrency(plane.basePrice)}</span></div>
                                </div>

                                <div className="flex flex-wrap items-center justify-end mt-auto pt-2 gap-4">
                                  <button onClick={() => onSelectAircraft(plane)} className="bg-aero-yellow text-black font-bold uppercase tracking-widest text-xs px-4 py-2.5 rounded-sm hover:bg-white transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                                    Purchase
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
