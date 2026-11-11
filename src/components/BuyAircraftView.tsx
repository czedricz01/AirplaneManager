import React, { useMemo, useState, useEffect } from 'react';
import { formatCurrency } from '../lib/format';
import { aircraftList, Aircraft } from '../data/aircraft';
import { Plane, ChevronDown, ChevronRight, Info, Search, UploadCloud, CheckCircle2, AlertCircle, Archive, Database, Lock } from 'lucide-react';
import { setSupabaseBucketUrl, getSupabaseBucketUrl, loadAircraftImagesMap } from '../lib/imageUtils';
import { AircraftImage } from './AircraftImage';
import { ViewHeader } from './ui/ViewHeader';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ALL_CLASS_IDS, classGateMessage, type AircraftClassId } from '../lib/aircraftClasses';

const ALL_CLASSES_OPEN: ReadonlySet<AircraftClassId> = new Set(ALL_CLASS_IDS);
import { AircraftMarketPanel, type AircraftMarketPanelProps, type MarketTab } from './AircraftMarketPanel';

interface Props {
  currentDateOffset: number;
  onSelectAircraft: (aircraft: Aircraft) => void;
  /** Passed down from App, which already owns this as state. */
  debugMode?: boolean;
  /** The aircraft classes the airline has developed (or flies); the others are shown but locked. */
  classesOpen?: ReadonlySet<AircraftClassId>;
  /** The order book and the used market; without it the shop sells new aircraft only. */
  market?: Omit<AircraftMarketPanelProps, 'tab'>;
}

function BuyAircraftViewImpl({ currentDateOffset, onSelectAircraft, debugMode: debugModeProp, classesOpen = ALL_CLASSES_OPEN, market }: Props) {
  const [tab, setTab] = useState<'new' | MarketTab>('new');
  const [expandedMfgs, setExpandedMfgs] = useState<Set<string>>(new Set());
  const [expandedPlaneId, setExpandedPlaneId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // Filters: first only aircraft the progression allows, then minimum range / seats and maximum price.
  const [onlyPurchasable, setOnlyPurchasable] = useState(false);
  const [minRange, setMinRange] = useState("");
  const [minCapacity, setMinCapacity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // Falls back to storage only when the prop is absent. This used to poll
  // localStorage every 500 ms for a value that already lives in App's state.
  const debugMode = debugModeProp ?? false;

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
          error: data.error || "Unexpected error while downloading."
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

  /** Loaded once per session; `refresh` after an upload changed the pictures. */
  const fetchImagesMap = (refresh = true) => {
    loadAircraftImagesMap(refresh).then(setImagesMap);
  };

  useEffect(() => {
    let active = true;
    loadAircraftImagesMap().then(map => { if (active) setImagesMap(map); });
    return () => { active = false; };
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
        error: `The ZIP file is too large (${fileSizeMB} MB). Uploads are limited to 30 MB per request. Make the archive smaller (for example by saving the images as JPG/WebP) or upload it in parts.`
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
        let errMessage = `Server error ${response.status}: ${response.statusText}`;
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
              errMessage = `The server did not answer with JSON (${response.status}). The ZIP file may be too large or damaged.`;
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
          error: data.error || "Unexpected error while extracting the ZIP file."
        });
      }
    } catch (err: any) {
      setUploadResult({
        success: false,
        extractedCount: 0,
        matchedPlanesCount: 0,
        error: err.message || "Network error while uploading the ZIP archive."
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
    // SVG is refused by the server: it can carry script and would be served
    // from the game's own origin.
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      setSingleUploadResult({
        success: false,
        error: "Only image files are allowed (.png, .jpg, .jpeg, .webp)."
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
        let errMessage = "Upload failed.";
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
          message: `The image for ${selectedAircraft.manufacturer} ${selectedAircraft.type} was uploaded and replaces the previous one.`
        });
        setSingleImageFile(null);
        // Reload map right away
        fetchImagesMap();
      } else {
        setSingleUploadResult({ success: false, error: resData.error || "Unexpected error." });
      }
    } catch (err: any) {
      setSingleUploadResult({ success: false, error: err.message || "Network error during upload." });
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
      if (onlyPurchasable && classGateMessage(a, classesOpen)) return false;
      if (minRange !== "" && a.maxRange < Number(minRange)) return false;
      if (minCapacity !== "" && a.capacity < Number(minCapacity)) return false;
      if (maxPrice !== "" && a.basePrice > Number(maxPrice)) return false;
      return true;
    });
  }, [currentDateOffset, searchTerm, debugMode, onlyPurchasable, minRange, minCapacity, maxPrice, classesOpen]);

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


  const generateSummary = (plane: Aircraft) => {
    return (
      <div className="flex flex-col gap-2">
        <p>The <strong>{plane.manufacturer} {plane.type}</strong> is widely recognized in the aviation industry for its distinct operational capabilities within the {plane.class.toLowerCase()} segment. Developed as a key member of the {plane.family} family, it addresses airline demands for efficient routing and optimal passenger loads.</p>
        <p>This model is capable of flying up to {plane.maxRange} km at a cruise speed of {plane.cruiseSpeed} km/h, equipped to comfortably carry {plane.capacity} passengers in a standard configuration. With an efficiency rating of {plane.efficiency}/100, it remains a competitive choice for modern fleets aiming to balance op-ex with passenger satisfaction ({plane.popularity}%).</p>
        <a 
          href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(plane.manufacturer + ' ' + plane.type)}`} 
          target="_blank" 
          rel="noreferrer"
          className="text-accent hover:underline mt-2 inline-flex items-center gap-1"
        >
          Research on Wikipedia ↗
        </a>
      </div>
    );
  };

  return (
    <div className="w-full text-ink px-3 py-3 lg:px-4 lg:py-4 short:py-1.5 flex flex-col font-sans h-full overflow-hidden">
      <ViewHeader
        title="Buy aircraft"
        right={
          <div className="relative w-full lg:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-muted" />
            </div>
            <input
              type="text"
              className="w-full bg-ground/40 border border-line rounded-sm py-2 pl-10 pr-4 text-sm text-ink focus:outline-none focus:border-accent/50 transition-colors"
              placeholder="Search Type, Manufacturer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        }
      />

      {market && (
        <div className="flex gap-2 border-b border-line mb-3 pr-4" role="tablist">
          {([['new', 'New aircraft'], ['orders', market.orders.length > 0 ? `Order book (${market.orders.length})` : 'Order book'], ['used', 'Used market']] as const).map(([id, text]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-3 py-2 -mb-px text-2xs uppercase tracking-label font-semibold border-b-2 transition-colors ${
                tab === id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {market && tab !== 'new' ? (
        <div className="flex-1 overflow-y-auto min-h-0 pr-4 pb-20">
          <AircraftMarketPanel {...market} tab={tab} />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto min-h-0 pr-4 space-y-6 pb-20">
        {/* Permanent Supabase Storage Bucket Settings */}
        {debugMode && (
          <div className="bg-ground border border-dashed border-accent/20 rounded-sm p-4 shrink-0 transition-all hover:border-accent/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-label text-sm font-semibold text-ink flex items-center gap-2">
                  <Database size={16} />
                  Supabase Storage Bucket (Permanent Images)
                  <Badge tone="warn">Debug</Badge>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Connected Supabase storage bucket URL for permanent aircraft image rendering across all devices.
                </p>
              </div>
              {getSupabaseBucketUrl() && (
                <Badge tone="yellow" className="self-start sm:self-center shrink-0">
                  <CheckCircle2 size={12} />
                  Bucket Active
                </Badge>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="e.g. https://xxxx.supabase.co/storage/v1/object/public/your-bucket-name"
                className="flex-1 bg-ground/60 border border-line rounded-sm px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent/60 transition-colors placeholder:text-muted"
                value={getSupabaseBucketUrl()}
                onChange={(e) => {
                  setSupabaseBucketUrl(e.target.value);
                  setSearchTerm(prev => prev); // re-trigger render
                }}
              />
              <button
                type="button"
                className="bg-surface hover:bg-raised text-ink text-xs px-4 py-2 border border-line rounded-sm transition-colors whitespace-nowrap"
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

          <div className="bg-ground border border-dashed border-line rounded-sm p-4 shrink-0 transition-all hover:border-rule space-y-6">

            {/* Part 1: ZIP Archive Uploader */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-label text-sm font-semibold text-ink flex items-center gap-2">
                    <Archive size={16} />
                    Planes Image ZIP customizer (SAT APPROVED)
                    <Badge tone="warn">Debug</Badge>
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Upload a ZIP archive of aircraft images (.png, .jpg, .webp). Each image is matched to its aircraft folder automatically.
                  </p>
                </div>
                
                <button 
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('zip-file-input');
                    if (el) el.click();
                  }}
                  className="self-start sm:self-center bg-accent text-on-accent font-label font-semibold uppercase tracking-label text-2xs px-4 py-2 hover:bg-ink transition-all transform hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
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
                  dragActive ? "border-accent bg-accent/5" : "border-line bg-ground/20 hover:border-line"
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
                
                <UploadCloud size={32} className={`mb-2 transition-colors ${dragActive ? 'text-accent' : 'text-muted'}`} />
                
                <p className="text-xs text-muted text-center">
                  {uploading ? (
                    <span className="text-accent animate-pulse">Analysing and extracting the ZIP file... please wait.</span>
                  ) : (
                    <span>Drop your image .zip here or <span className="text-accent font-semibold cursor-pointer underline">click to browse</span></span>
                  )}
                </p>
              </div>

              {/* URL Fetching Area */}
              <div className="mt-3 bg-ground/20 p-3 border border-line rounded-sm">
                <div className="text-2xs text-muted font-semibold mb-2">Or load a ZIP straight from a link (e.g. Google Drive)</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="https://drive.google.com/file/d/.../view"
                    className="flex-1 bg-ground/50 border border-line rounded-sm px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent/50 placeholder:text-muted"
                    value={zipUrl}
                    onChange={e => setZipUrl(e.target.value)}
                    disabled={fetchingUrl}
                  />
                  <button
                    type="button"
                    className="bg-surface hover:bg-raised text-ink text-xs px-4 py-2 border border-line rounded-sm transition-colors whitespace-nowrap disabled:opacity-50"
                    onClick={handleZipUrlSubmit}
                    disabled={!zipUrl || fetchingUrl}
                  >
                    {fetchingUrl ? "Loading..." : "Load from URL"}
                  </button>
                </div>
              </div>

              {/* Results Feedback */}
              {uploadResult && (
                <div className={`mt-3 p-3 rounded-sm border font-mono text-xs flex items-start gap-2.5 ${
                  uploadResult.success 
                    ? "bg-good/10 text-good border-good/30 animate-appear" 
                    : "bg-bad/10 text-bad border-bad/30 animate-appear"
                }`}>
                  {uploadResult.success ? (
                    <>
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-accent" />
                      <div>
                        <div className="font-semibold uppercase tracking-label">Zip-extraktion erfolgreich</div>
                        <div className="mt-1 leading-relaxed">
                          <strong className="text-ink">{uploadResult.extractedCount} images</strong> were extracted and assigned to <strong className="text-ink">{uploadResult.matchedPlanesCount} aircraft models</strong>.
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-accent" />
                      <div>
                        <div className="font-semibold uppercase tracking-label">Fehler BEI extraktion</div>
                        <div className="mt-1 leading-relaxed">{uploadResult.error}</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Elegant separation line */}
            <div className="h-px bg-surface my-5" />

            {/* Part 2: Dynamic Single Image Search, Filter and Direct Uploader */}
            <div className="space-y-4">
              <div>
                <h3 className="font-label text-sm font-semibold text-ink flex items-center gap-2">
                  <Plane size={16} />
                  Single Aircraft Image Uploader (SAT APPROVED)
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Search for an aircraft type, filter for models without an image and upload a single image. It replaces any previous image.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {/* Left Column: Filter and select aircraft type */}
                <div className="flex flex-col min-w-0">
                  <div className="flex flex-col gap-2 mb-2">
                    <span className="text-2xs font-label uppercase tracking-label text-muted font-semibold">1. Select or search for a model</span>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {/* Search tool block */}
                      <div className="relative flex-1">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                          type="text"
                          className="w-full bg-ground/50 border border-line rounded-sm py-1.5 pl-8 pr-3 text-xs text-ink focus:outline-none focus:border-accent/40"
                          placeholder="Search model (e.g. A320)..."
                          value={singleSearchTerm}
                          onChange={(e) => setSingleSearchTerm(e.target.value)}
                        />
                      </div>

                      {/* Toggle button */}
                      <button
                        type="button"
                        onClick={() => setOnlyMissingImages(!onlyMissingImages)}
                        className={`px-3 py-1.5 text-2xs font-label uppercase border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          onlyMissingImages 
                            ? "bg-accent/10 border-accent text-accent font-semibold" 
                            : "bg-ground/40 border-line text-muted hover:text-ink"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${onlyMissingImages ? "bg-accent" : "bg-raised"}`} />
                        Only without image
                      </button>
                    </div>
                  </div>

                  {/* Scrollable container with unique ID */}
                  <div 
                    id="aircraft-debug-picker-list"
                    className="border border-line bg-ground/50 rounded-sm max-h-48 overflow-y-auto text-xs divide-y divide-line"
                  >
                    {singleImageFilteredAircraft.length === 0 ? (
                      <div className="p-4 text-center text-muted uppercase tracking-label text-2xs">No matching models</div>
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
                                ? "bg-accent/5 border-l-2 border-accent text-accent font-semibold" 
                                : "hover:bg-raised text-muted"
                            }`}
                          >
                            <span className="truncate pr-1">{a.manufacturer} {a.type}</span>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className="text-2xs text-muted truncate max-w-[80px]">{a.family}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${hasCustom ? "bg-accent/20" : "bg-accent"}`} title={hasCustom ? "Has image" : "No image"} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-1 text-2xs text-muted flex justify-between">
                    <span>{singleImageFilteredAircraft.length} models found</span>
                    <span>{Object.keys(imagesMap).length} uploaded images in total</span>
                  </div>
                </div>

                {/* Right Column: Upload action box */}
                <div className="flex flex-col justify-between min-w-0">
                  <div className="space-y-2">
                    <span className="text-2xs font-label uppercase tracking-label text-muted font-semibold block">2. Choose an image and upload</span>
                    
                    {selectedAircraft ? (
                      <div className="bg-ground/40 border border-line rounded-sm p-3 text-xs text-ink space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xs text-muted uppercase tracking-label font-semibold">Selected model:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAircraft(null);
                              setSingleImageFile(null);
                              setSingleUploadResult(null);
                            }}
                            className="text-muted hover:text-accent text-2xs uppercase cursor-pointer"
                          >
                            [Cancel]
                          </button>
                        </div>
                        <div className="font-semibold text-xs text-ink uppercase tracking-label bg-surface p-1.5 rounded-sm truncate">
                          {selectedAircraft.manufacturer} {selectedAircraft.type}
                        </div>
                        
                        {/* Area triggers local upload picker */}
                        <div 
                          id="single-image-drag-area"
                          onClick={() => {
                            const el = document.getElementById('single-image-file-input');
                            if (el) el.click();
                          }}
                          className="border border-dashed border-line hover:border-accent/40 rounded-sm p-3 flex flex-col items-center justify-center cursor-pointer bg-ground/50 transition-colors"
                        >
                          <input
                            id="single-image-file-input"
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                processSingleFile(e.target.files[0]);
                              }
                            }}
                          />
                          {singleImageFile ? (
                            <div className="text-center">
                              <span className="text-accent font-semibold block truncate max-w-[200px]" title={singleImageFile.name}>
                                {singleImageFile.name}
                              </span>
                              <span className="text-2xs text-muted block mt-0.5">
                                {(singleImageFile.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          ) : (
                            <div className="text-center text-muted space-y-1 py-1">
                              <UploadCloud size={18} className="mx-auto text-muted" />
                              <span className="text-2xs block text-accent font-semibold underline">Choose image file</span>
                              <span className="text-2xs block">Png, JPG or webp</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-line bg-ground/20 rounded-sm py-4 px-4 text-center text-muted text-xs flex flex-col items-center justify-center h-[122px]">
                        <Plane size={20} className="mb-1.5 text-muted animate-pulse" />
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
                        className="w-full bg-accent text-on-accent font-label font-semibold uppercase tracking-label text-2xs py-2 px-3 hover:bg-ink transition-all transform hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                        disabled={singleUploading}
                      >
                        {singleUploading ? "UPLOADING IMAGE..." : "UPLOAD & REPLACE IMAGE"}
                      </button>
                    )}

                    {singleUploadResult && (
                      <div className={`p-2.5 rounded-sm border font-mono text-2xs flex items-start gap-2 ${
                        singleUploadResult.success 
                          ? "bg-good/10 text-good border-good/30 animate-appear" 
                          : "bg-bad/10 text-bad border-bad/30 animate-appear"
                      }`}>
                        {singleUploadResult.success ? (
                          <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-accent" />
                        ) : (
                          <AlertCircle size={12} className="shrink-0 mt-0.5 text-accent" />
                        )}
                        <div>
                          <span className="font-semibold uppercase block">{singleUploadResult.success ? "SATISFACTION COMPLETE" : "FEHLER"}</span>
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

        {/* Filters: purchasable first, then range, capacity and price */}
        <div className="flex flex-wrap items-end gap-3 bg-ground/40 border border-line rounded-sm p-3 shrink-0">
          <button
            type="button"
            aria-pressed={onlyPurchasable}
            onClick={() => setOnlyPurchasable(v => !v)}
            className={`px-3 py-2 text-2xs uppercase tracking-label border transition-colors flex items-center gap-1.5 ${
              onlyPurchasable ? 'bg-accent/10 border-accent text-accent font-semibold' : 'bg-ground/40 border-line text-muted hover:text-ink'
            }`}
          >
            <Lock size={12} aria-hidden="true" /> Only purchasable
          </button>
          {([
            ['Min range (km)', minRange, setMinRange],
            ['Min capacity (pax)', minCapacity, setMinCapacity],
            ['Max price ($)', maxPrice, setMaxPrice],
          ] as const).map(([label, value, set]) => (
            <label key={label} className="flex flex-col gap-1 text-2xs uppercase tracking-label text-muted">
              {label}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={value}
                onChange={e => set(e.target.value)}
                className="w-36 bg-ground/50 border border-line rounded-sm px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-accent/50"
              />
            </label>
          ))}
          {(onlyPurchasable || minRange || minCapacity || maxPrice) && (
            <button
              type="button"
              onClick={() => { setOnlyPurchasable(false); setMinRange(""); setMinCapacity(""); setMaxPrice(""); }}
              className="px-3 py-2 text-2xs uppercase tracking-label text-muted hover:text-accent"
            >
              Reset filters
            </button>
          )}
          <span className="ml-auto text-2xs text-muted">{availableAircraft.length} aircraft</span>
        </div>

        {manufacturers.length === 0 ? (
          <div className="text-muted text-center uppercase tracking-label mt-12 w-full">No aircraft available in this ERA.</div>
        ) : manufacturers.map(mfg => {
          const familiesMap = grouped.get(mfg)!;
          const families = Array.from(familiesMap.keys()).sort();
          const isExpanded = expandedMfgs.has(mfg);
          
          return (
            <div key={mfg} className="flex flex-col bg-ground/40 border border-line rounded-sm overflow-hidden shrink-0">
              <button 
                onClick={() => toggleMfg(mfg)} 
                className={`flex items-center gap-3 p-4 bar:py-3 short:py-2 px-3 w-full text-left transition-colors ${isExpanded ? 'bg-surface border-b border-line text-accent' : 'hover:bg-raised hover:text-ink text-ink'}`}
              >
                {isExpanded ? <ChevronDown size={24} /> : <ChevronRight size={24} className="opacity-50" />}
                <span className="text-2xl bar:text-xl short:text-lg font-semibold leading-none">{mfg}</span>
                <span className="ml-auto text-xs font-mono opacity-50">{familiesMap.size} Families</span>
              </button>
              
              {isExpanded && (
                <div className="flex flex-col gap-10 bar:gap-6 short:gap-4 p-4 bar:p-3 short:p-2.5">
                  {families.map(fam => {
                    const planes = familiesMap.get(fam)!;
                    return (
                      <div key={fam} className="flex flex-col gap-4">
                        <h4 className="font-label text-lg text-ink font-semibold border-b border-line pb-2">{fam}</h4>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {planes.map(plane => {
                            const imageName = (plane.manufacturer + ' ' + plane.type).split('/').join('-').split('\\').join('-');
                            return (
                              <div key={plane.id} className="bg-surface border border-line rounded-sm p-4 bar:p-3 short:p-2.5 flex flex-row gap-3 hover:border-accent/50 transition-colors group relative overflow-hidden">
                                {/* Aircraft Tech Drawing Blueprint Graphic. On phones a
                                    thumbnail beside the figures; full width it filled
                                    the screen with one aircraft at a time. */}
                                <div className={`shrink-0 bg-ground/40 rounded-sm border border-line overflow-hidden flex items-center justify-center relative transition-all duration-300 self-start ${expandedPlaneId === plane.id ? 'w-24 sm:w-64 short:w-28 aspect-square' : 'w-24 sm:w-48 short:w-28 aspect-square'}`}>
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
                                    className="font-semibold text-xl cursor-pointer hover:text-accent flex items-center gap-2 transition-colors truncate"
                                    onClick={() => setExpandedPlaneId(expandedPlaneId === plane.id ? null : plane.id)}
                                    title="Click to view details"
                                  >
                                    <span className="truncate">{plane.type}</span>
                                    <Info size={16} className={`shrink-0 transition-colors ${expandedPlaneId === plane.id ? 'text-accent' : 'text-muted'}`} />
                                  </h5>
                                  <div className="text-xs border border-accent/20 text-muted px-2 py-0.5 rounded-sm uppercase tracking-label bg-accent/5 shrink-0 ml-2 whitespace-nowrap">{plane.class}</div>
                                </div>

                                {expandedPlaneId === plane.id && (
                                  <div className="mb-4 text-xs text-muted leading-relaxed bg-ground/40 p-3 rounded-sm border border-line animate-appear">
                                    {generateSummary(plane)}
                                  </div>
                                )}

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-4 text-xs text-muted mb-4">
                                  <div className="flex flex-col border-b border-line pb-1"><span className="text-2xs uppercase tracking-label mb-1 opacity-70">Plane type SAT</span><span className="text-ink font-semibold">{plane.popularity}%</span></div>
                                  <div className="flex flex-col border-b border-line pb-1"><span className="text-2xs uppercase tracking-label mb-1 opacity-70">Efficiency</span><span className="text-ink font-semibold">{plane.efficiency}/100</span></div>
                                  <div className="flex flex-col border-b border-line pb-1"><span className="text-2xs uppercase tracking-label mb-1 opacity-70">Max Range</span><span className="text-ink font-semibold">{plane.maxRange} km</span></div>
                                  <div className="flex flex-col border-b border-line pb-1"><span className="text-2xs uppercase tracking-label mb-1 opacity-70">Capacity</span><span className="text-ink font-semibold">{plane.capacity} pax</span></div>
                                  <div className="flex flex-col border-b border-line pb-1"><span className="text-2xs uppercase tracking-label mb-1 opacity-70">Cruise Speed</span><span className="text-ink font-semibold">{plane.cruiseSpeed} km/h</span></div>
                                  <div className="flex flex-col border-b border-line pb-1"><span className="text-2xs uppercase tracking-label mb-1 opacity-70">Base Price</span><span className="text-accent font-semibold">{formatCurrency(plane.basePrice)}</span></div>
                                </div>

                                <div className="flex flex-wrap items-center justify-end mt-auto pt-2 gap-4">
                                  {(() => {
                                    const gate = classGateMessage(plane, classesOpen);
                                    return gate ? (
                                      <>
                                        <span className="flex items-center gap-2 text-2xs text-bad mr-auto">
                                          <Lock size={12} aria-hidden="true" /> {gate}
                                        </span>
                                        <Button variant="secondary" size="md" disabled>Locked</Button>
                                      </>
                                    ) : (
                                      <Button
                                        variant="primary"
                                        size="md"
                                        onClick={() => onSelectAircraft(plane)}
                                        className="transform hover:scale-[1.02] active:scale-[0.98]"
                                      >
                                        Purchase
                                      </Button>
                                    );
                                  })()}
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
      )}
    </div>
  );
}

/**
 * Memoised: this view stays mounted while App re-renders for unrelated state
 * (messages, dialogs, settings), and it only needs to redraw when its own
 * props change. App passes stable callbacks for exactly this reason.
 */
export const BuyAircraftView = React.memo(BuyAircraftViewImpl);
