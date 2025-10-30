'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface BulkUpload {
  id: string;
  filename: string;
  comment: string | null;
  dateReleased: string;
  uploadedAt: string;
  fileUrl: string;
  fileSize: number;
  stats: {
    total: number;
    inserts: number;
    updates: number;
    deletes: number;
  };
}

interface DiffItem {
  externalId: string;
  changeType: 'INSERT' | 'UPDATE' | 'DELETE';
  current?: {
    name: string;
    gender: string;
    dateOfBirth: Date;
  };
  incoming: {
    name: string;
    gender: string;
    dateOfBirth: Date;
  };
}

interface SimulationResult {
  summary: {
    totalIncoming: number;
    inserts: number;
    updates: number;
    deletes: number;
  };
  samples: {
    inserts: DiffItem[];    // First 10 for preview
    updates: DiffItem[];    // First 10 for preview
    deletions: DiffItem[];  // First 10 for preview
  };
}

export default function BulkUploadsClient() {
  const [uploads, setUploads] = useState<BulkUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [label, setLabel] = useState<string>('');
  const [dateReleased, setDateReleased] = useState<string>('');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null); // Store blob URL for reuse between simulate and apply
  const [blobMetadata, setBlobMetadata] = useState<{ size: number; sha256: string; contentType: string; previewLines?: string | null } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [simulationExpiresAt, setSimulationExpiresAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // INLINE ERROR/SUCCESS STATE (Legacy - kept for easy revert)
  // Uncomment these and the render code below to return to inline error/success messages
  // const [error, setError] = useState<string | null>(null);
  // const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchUploads();
  }, []);

  // 5-minute timeout: Reset form after simulation expires
  useEffect(() => {
    if (!simulationExpiresAt) return;

    const now = Date.now();
    const timeUntilExpiry = simulationExpiresAt - now;

    if (timeUntilExpiry <= 0) {
      // Already expired
      handleSimulationExpired();
      return;
    }

    const timer = setTimeout(() => {
      handleSimulationExpired();
    }, timeUntilExpiry);

    return () => clearTimeout(timer);
  }, [simulationExpiresAt]);

  const handleSimulationExpired = () => {
    toast.error('Simulation expired after 5 minutes', {
      description: 'Please re-simulate before applying',
      duration: 5000,
    });
    setSimulation(null);
    setBlobUrl(null);
    setBlobMetadata(null);
    setSimulationExpiresAt(null);
  };

  const fetchUploads = async () => {
    try {
      const response = await fetch('/api/admin/bulk-upload/list');
      const text = await response.text();
      if (!text) return;
      const data = JSON.parse(text);
      if (data.success) {
        setUploads(data.uploads);
      }
    } catch (err) {
      console.error('Failed to fetch uploads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSimulation(null);
      setBlobUrl(null); // Reset blob URL when new file is selected
      setBlobMetadata(null); // Reset blob metadata when new file is selected
      setSimulationExpiresAt(null); // Clear expiration timer
      
      // Auto-populate date released from filename
      // Expected patterns: MoH-YYYY-MM-DD.csv or MoH-YYYY-MM-DD_edited.csv
      const dateMatch = file.name.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        const extractedDate = `${year}-${month}-${day}`;
        setDateReleased(extractedDate);
        toast.success('Date auto-populated from filename', {
          description: `Set to: ${extractedDate}`,
        });
      }
    }
  };

  const handleSimulate = async () => {
    if (!selectedFile) return;
    if (!dateReleased.trim()) { 
      toast.error('Please provide the date when this data was released', { duration: Infinity });
      return; 
    }

    console.log('[CLIENT] 🚀 Starting bulk upload simulation');
    console.log('[CLIENT] 📄 File details:', {
      name: selectedFile.name,
      size: selectedFile.size,
      sizeMB: (selectedFile.size / 1024 / 1024).toFixed(2),
      type: selectedFile.type,
    });
    console.log('[CLIENT] 📋 Metadata:', { label, dateReleased });

    setSimulating(true);
    
    // STEP 1: Validate CSV locally BEFORE uploading
    const validationToast = toast.loading('Validating CSV file...', {
      description: 'Checking format and data integrity',
      duration: Infinity,
    });
    
    try {
      console.log('[CLIENT] 📋 Reading file for validation...');
      const fileContent = await selectedFile.text();
      
      console.log('[CLIENT] ✅ File read, validating...');
      const { validateCSVContent } = await import('@/lib/csv-validation-client');
      const validation = validateCSVContent(fileContent);
      
      if (!validation.valid) {
        console.error('[CLIENT] ❌ Validation failed:', validation.error);
        toast.error(validation.error || 'CSV validation failed', {
          id: validationToast,
          description: validation.details,
          duration: Infinity,
        });
        setSimulating(false);
        return; // Stop here - don't upload invalid file!
      }
      
      console.log('[CLIENT] ✅ Validation passed:', validation.rowCount, 'rows');
      toast.success(`CSV validated: ${validation.rowCount} rows`, {
        id: validationToast,
        duration: 2000,
      });
    } catch (err) {
      console.error('[CLIENT] ❌ Validation error:', err);
      toast.error('Failed to validate CSV', {
        id: validationToast,
        description: err instanceof Error ? err.message : 'Unknown error',
        duration: Infinity,
      });
      setSimulating(false);
      return;
    }
    
    // STEP 2: Upload to blob storage (only if validation passed)
    const simulateToast = toast.loading('Uploading file to blob storage...', {
      description: `Uploading ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB directly to storage`,
      duration: Infinity,
    });
    
    try {
      console.log('[CLIENT] ⬆️ Starting direct blob upload via @vercel/blob/client');
      console.log('[CLIENT] 🔗 Upload URL:', '/api/admin/bulk-upload/upload-csv');
      console.log('[CLIENT] 📋 Original filename:', selectedFile.name);
      
      // Upload to bulk-uploads folder with original filename
      // Server will add random suffix automatically
      const pathname = `bulk-uploads/${selectedFile.name}`;
      console.log('[CLIENT] 📝 Upload pathname:', pathname);
      
      const newBlob = await upload(pathname, selectedFile, {
        access: 'public',
        handleUploadUrl: '/api/admin/bulk-upload/upload-csv',
      });
      
      console.log('[CLIENT] ✅ Blob upload complete!');
      console.log('[CLIENT] 🔗 Blob URL:', newBlob.url);
      console.log('[CLIENT] 📦 Blob details:', {
        url: newBlob.url,
        pathname: newBlob.pathname,
        contentType: newBlob.contentType,
        contentDisposition: newBlob.contentDisposition,
      });
      
      const uploadedBlobUrl = newBlob.url;
      setBlobUrl(uploadedBlobUrl);
      
      // STEP 3: Simulate changes
      toast.loading('Simulating changes...', {
        id: simulateToast,
        description: 'Comparing CSV with database to detect changes',
        duration: Infinity,
      });
      
      console.log('[CLIENT] 🔄 Starting simulation with blob URL');
      const simulateResponse = await fetch('/api/admin/bulk-upload/simulate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl: uploadedBlobUrl })
      });
      
      console.log('[CLIENT] 📨 Simulation response status:', simulateResponse.status);
      const text = await simulateResponse.text();
      console.log('[CLIENT] 📨 Simulation response body length:', text.length);
      const data = text ? JSON.parse(text) : {};
      
      if (!simulateResponse.ok) {
        toast.error(data.error || 'Simulation failed', { 
          id: simulateToast,
          duration: Infinity,
        });
        setSimulation(null);
      } else {
        console.log('[CLIENT] ✅ Simulation successful!');
        console.log('[CLIENT] 📊 Summary:', data.simulation.summary);
        console.log('[CLIENT] 📦 Blob metadata:', data.blobMetadata);
        setSimulation(data.simulation);
        setBlobMetadata(data.blobMetadata);
        
        // Set 5-minute expiration timer (large files take 3-4 minutes to apply)
        const expiresAt = Date.now() + 300000; // 5 minutes (300 seconds) from now
        setSimulationExpiresAt(expiresAt);
        
        const { summary } = data.simulation;
        toast.success('Simulation complete!', { 
          id: simulateToast,
          description: `${summary.inserts} inserts, ${summary.updates} updates, ${summary.deletes} deletes. Valid for 5 minutes.`,
          duration: Infinity,
        });
      }
    } catch (err) {
      console.error('[CLIENT] ❌ Simulation error:', err);
      console.error('[CLIENT] 📋 Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : undefined,
      });
      
      toast.error('Failed to simulate upload', { 
        id: simulateToast,
        description: err instanceof Error ? err.message : 'Unknown error',
        duration: Infinity,
      });
    } finally {
      setSimulating(false);
      console.log('[CLIENT] 🏁 Simulation process complete');
    }
  };

  const handleApply = async () => {
    if (!selectedFile) return;
    if (!blobUrl) {
      toast.error('Please simulate the upload first', { duration: Infinity });
      return;
    }
    if (!blobMetadata) {
      toast.error('Missing blob metadata. Please re-simulate the upload', { duration: Infinity });
      return;
    }
    if (!dateReleased.trim()) { 
      toast.error('Please provide the date when this data was released', { duration: Infinity });
      return;
    }

    console.log('[CLIENT] 🚀 Starting bulk upload apply');
    console.log('[CLIENT] 🔗 Blob URL:', blobUrl);
    console.log('[CLIENT] 📦 Blob metadata:', blobMetadata);
    console.log('[CLIENT] 📋 Metadata:', { 
      label: label.trim(), 
      dateReleased, 
      filename: selectedFile.name 
    });

    setApplying(true);
    const applyToast = toast.loading('Applying bulk upload...', {
      description: 'Server is re-parsing CSV and applying changes. This may take 3-4 minutes for large files.',
      duration: Infinity,
    });
    
    try {
      console.log('[CLIENT] 📤 Sending apply request to API (no simulation data, server will re-parse)');
      
      const response = await fetch('/api/admin/bulk-upload/apply', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl,
          blobMetadata,
          label: label.trim(),
          dateReleased,
          filename: selectedFile.name
        })
      });
      
      console.log('[CLIENT] 📨 Apply response status:', response.status);
      const text = await response.text();
      console.log('[CLIENT] 📨 Apply response body length:', text.length);
      const data = text ? JSON.parse(text) : {};
      
      if (!response.ok) {
        toast.error(data.error || 'Apply failed', { 
          id: applyToast,
          duration: Infinity,
        });
      } else {
        console.log('[CLIENT] ✅ Apply successful!');
        console.log('[CLIENT] 📋 Upload ID:', data.uploadId);
        console.log('[CLIENT] 📊 Stats:', data.stats);
        
        // Clear form state
        setSelectedFile(null);
        setLabel('');
        setDateReleased('');
        setSimulation(null);
        setBlobUrl(null);
        setBlobMetadata(null);
        setSimulationExpiresAt(null);
        
        // Clear file input element
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        fetchUploads().catch(err => console.error('Failed to refresh uploads:', err));
        toast.success('Bulk upload applied successfully!', { 
          id: applyToast,
          description: `${data.uploadId ? 'Upload ID: ' + data.uploadId : ''}`,
          duration: Infinity,
        });
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('[CLIENT] ❌ Apply error:', err);
      console.error('[CLIENT] 📋 Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : undefined,
      });
      
      toast.error('Failed to apply upload', { 
        id: applyToast,
        duration: Infinity,
      });
      console.error(err);
    } finally {
      setApplying(false);
      console.log('[CLIENT] 🏁 Apply process complete');
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setLabel('');
    setDateReleased('');
    setSimulation(null);
    setBlobUrl(null);
    setBlobMetadata(null);
    setSimulationExpiresAt(null);
    
    // Clear file input element
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
  const formatDateOfBirth = (date: Date | string) => new Date(date).toLocaleDateString();
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-background pt-8 pb-8 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Bulk Uploads</h1>
          <p className="text-muted-foreground mt-2">Upload and manage Ministry of Health CSV files</p>
        </div>

        {/* LEGACY: Inline success banner - replaced with toast notifications */}
        {/* Uncomment to revert to inline success messages */}
        {/* {success && (
          <div className="mb-4 bg-accent border text-accent-foreground px-4 py-3 rounded relative">
            {success}
            <button onClick={() => setSuccess(null)} className="absolute top-0 right-0 px-4 py-3">
              <span className="text-2xl">&times;</span>
            </button>
          </div>
        )} */}

        <div className="bg-card rounded-lg border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">New Bulk Upload</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Upload CSV File</label>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv" 
                onChange={handleFileChange} 
                className="w-full md:w-1/2 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/5 file:text-primary hover:file:bg-primary/10"
              />
              <p className="mt-2 text-sm text-muted-foreground">CSV will be validated before upload. Required: id, name_ar_raw, sex, dob</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Date Released <span className="text-destructive">*</span></label>
              <input type="date" value={dateReleased} onChange={(e) => setDateReleased(e.target.value)} className="w-full md:w-1/2 px-3 py-2 border rounded-md shadow-sm focus:ring-ring focus:border-primary sm:text-sm text-foreground" required/>
              <p className="mt-1 text-sm text-muted-foreground">When was this source data published/released? (required)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Comment</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Q4 2024 Update, January Corrections, etc." className="w-full md:w-1/2 px-3 py-2 border rounded-md shadow-sm focus:ring-ring focus:border-primary sm:text-sm text-foreground placeholder-muted-foreground" maxLength={200}/>
              <p className="mt-1 text-sm text-muted-foreground">Optional: Provide a description to identify this upload</p>
            </div>
            {/* LEGACY: Inline error box - replaced with toast notifications */}
            {/* Uncomment to revert to inline error messages: */}
            {/* 
            {error && (
              <div className="bg-destructive/5 border border-destructive/20 text-destructive px-4 py-3 rounded">
                {error}
              </div>
            )}
            */}
            <div className="flex gap-4">
              <Button 
                onClick={handleSimulate} 
                disabled={!selectedFile || simulation !== null || simulating}
              >
                {simulating ? 'Simulating...' : 'Simulate Upload'}
              </Button>
              {simulation && (
                <>
                  <Button 
                    onClick={handleApply} 
                    disabled={!simulation || applying}
                  >
                    {applying ? 'Applying...' : 'Apply Upload'}
                  </Button>
                  <Button 
                    onClick={handleCancel} 
                    disabled={applying} 
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
            {simulation && (
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-lg">Simulation Results</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-muted p-4 rounded"><div className="text-sm text-muted-foreground">Total After Update</div><div className="text-2xl font-bold">{simulation.summary.totalIncoming}</div></div>
                  <div className="bg-accent p-4 rounded"><div className="text-sm text-accent-foreground">Inserts</div><div className="text-2xl font-bold text-accent-foreground">{simulation.summary.inserts}</div></div>
                  <div className="bg-secondary/20 p-4 rounded"><div className="text-sm text-secondary-foreground">Updates</div><div className="text-2xl font-bold text-secondary-foreground">{simulation.summary.updates}</div></div>
                  <div className="bg-destructive/5 p-4 rounded"><div className="text-sm text-destructive">Deletes</div><div className="text-2xl font-bold text-destructive">{simulation.summary.deletes}</div></div>
                </div>
                {simulation.samples.deletions.length > 0 && (
                  <div className="border border-destructive/20 rounded-lg p-4 bg-destructive/5">
                    <h4 className="font-medium mb-2 text-destructive">⚠️ Records to be Deleted (showing {simulation.samples.deletions.length} of {simulation.summary.deletes})</h4>
                    <p className="text-sm text-destructive mb-3">These records exist in the database but are NOT in the CSV file:</p>
                    <div className="overflow-x-auto max-h-96">
                      <table className="min-w-full divide-y divide-border bg-background">
                        <thead className="bg-destructive/10"><tr><th className="px-4 py-2 text-left text-xs font-medium text-destructive uppercase">External ID</th><th className="px-4 py-2 text-left text-xs font-medium text-destructive uppercase">Name</th><th className="px-4 py-2 text-left text-xs font-medium text-destructive uppercase">Gender</th><th className="px-4 py-2 text-left text-xs font-medium text-destructive uppercase">Date of Birth</th></tr></thead>
                        <tbody className="divide-y divide-border">
                          {simulation.samples.deletions.map((diff, idx) => (
                            <tr key={idx} className="hover:bg-destructive/5"><td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{diff.externalId}</td><td className="px-4 py-2 text-sm">{diff.current?.name}</td><td className="px-4 py-2 whitespace-nowrap text-sm">{diff.current?.gender}</td><td className="px-4 py-2 whitespace-nowrap text-sm">{diff.current && formatDateOfBirth(diff.current.dateOfBirth)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {simulation.samples.updates.length > 0 && (
                  <div className="border rounded-lg p-4 bg-secondary/20">
                    <h4 className="font-medium mb-2 text-secondary-foreground">📝 Records to be Updated (showing {simulation.samples.updates.length} of {simulation.summary.updates})</h4>
                    <p className="text-sm text-secondary-foreground mb-3">These records will be modified:</p>
                    <div className="overflow-x-auto max-h-96">
                      <table className="min-w-full divide-y divide-border bg-background">
                        <thead className="bg-secondary/50"><tr><th className="px-4 py-2 text-left text-xs font-medium text-secondary-foreground uppercase">External ID</th><th className="px-4 py-2 text-left text-xs font-medium text-secondary-foreground uppercase">Current</th><th className="px-4 py-2 text-left text-xs font-medium text-secondary-foreground uppercase">→ New</th></tr></thead>
                        <tbody className="divide-y divide-border">
                          {simulation.samples.updates.map((diff, idx) => (
                            <tr key={idx} className="hover:bg-secondary/20">
                              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{diff.externalId}</td>
                              <td className="px-4 py-2 text-sm">
                                {diff.current && (
                                  <div className="text-xs">
                                    <div className={diff.current.name !== diff.incoming.name ? 'line-through text-destructive' : ''}>{diff.current.name}</div>
                                    <div className="text-muted-foreground">
                                      <span className={diff.current.gender !== diff.incoming.gender ? 'line-through text-destructive' : ''}>{diff.current.gender}</span>
                                      {' • '}
                                      <span className={formatDateOfBirth(diff.current.dateOfBirth) !== formatDateOfBirth(diff.incoming.dateOfBirth) ? 'line-through text-destructive' : ''}>
                                        {formatDateOfBirth(diff.current.dateOfBirth)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <div className="text-xs">
                                  <div className={diff.current && diff.current.name !== diff.incoming.name ? 'font-semibold text-accent-foreground' : ''}>{diff.incoming.name}</div>
                                  <div className="text-muted-foreground">
                                    <span className={diff.current && diff.current.gender !== diff.incoming.gender ? 'font-semibold text-accent-foreground' : ''}>{diff.incoming.gender}</span>
                                    {' • '}
                                    <span className={diff.current && formatDateOfBirth(diff.current.dateOfBirth) !== formatDateOfBirth(diff.incoming.dateOfBirth) ? 'font-semibold text-accent-foreground' : ''}>
                                      {formatDateOfBirth(diff.incoming.dateOfBirth)}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {simulation.samples.inserts.length > 0 && (
                  <div className="border rounded-lg p-4 bg-accent">
                    <h4 className="font-medium mb-2 text-accent-foreground">✨ Sample New Records (showing {simulation.samples.inserts.length} of {simulation.summary.inserts})</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border bg-background">
                        <thead className="bg-accent"><tr><th className="px-4 py-2 text-left text-xs font-medium text-accent-foreground uppercase">External ID</th><th className="px-4 py-2 text-left text-xs font-medium text-accent-foreground uppercase">Name</th><th className="px-4 py-2 text-left text-xs font-medium text-accent-foreground uppercase">Gender</th><th className="px-4 py-2 text-left text-xs font-medium text-accent-foreground uppercase">Date of Birth</th></tr></thead>
                        <tbody className="divide-y divide-border">
                          {simulation.samples.inserts.map((diff, idx) => (
                            <tr key={idx} className="hover:bg-accent"><td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{diff.externalId}</td><td className="px-4 py-2 text-sm">{diff.incoming.name}</td><td className="px-4 py-2 whitespace-nowrap text-sm">{diff.incoming.gender}</td><td className="px-4 py-2 whitespace-nowrap text-sm">{formatDateOfBirth(diff.incoming.dateOfBirth)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Past Uploads</h2>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No uploads yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Filename</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Comment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date Released</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Changes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Inserts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Updates</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Deletes</th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {uploads.map((upload) => (
                    <tr key={upload.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{upload.filename}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex flex-col gap-1">
                          <a 
                            href={upload.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs font-medium"
                            title="Download original CSV from Blob storage"
                          >
                            📥 Download
                          </a>
                          <span className="text-muted-foreground text-xs">{formatFileSize(upload.fileSize)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-muted-foreground hover:text-foreground transition-colors">
                                <Info className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{upload.comment}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{formatDateOfBirth(upload.dateReleased)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{formatDate(upload.uploadedAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{upload.stats.total}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-accent-foreground">{upload.stats.inserts}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-foreground">{upload.stats.updates}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-destructive">{upload.stats.deletes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


