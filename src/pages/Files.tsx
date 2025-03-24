import React, { useState, useEffect } from 'react';
import { Upload, File, MoreVertical, Download, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StoredFile {
  id: string;
  file_name: string;
  file_size: number;
  ipfs_cid: string;
  mime_type: string;
  created_at: string;
  provider_id: string;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day'
  );
}

function FileRow({ file, onDelete }: { file: StoredFile; onDelete: (id: string) => void }) {
  const handleDownload = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_IPFS_GATEWAY}${file.ipfs_cid}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-purple-50 rounded-lg">
          <File className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
          <p className="text-xs text-gray-500">{formatFileSize(file.file_size)} • {formatDate(file.created_at)}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleDownload}
          className="p-2 text-gray-500 hover:text-gray-700"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(file.id)}
          className="p-2 text-gray-500 hover:text-gray-700"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Files() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchFiles = async () => {
      const { data: userAddress } = await supabase.auth.getUser();
      if (!userAddress.user) return;

      const { data, error } = await supabase
        .from('stored_files')
        .select('*')
        .eq('user_address', userAddress.user.id);

      if (error) {
        console.error('Error fetching files:', error);
        return;
      }

      setFiles(data || []);
    };

    fetchFiles();

    const subscription = supabase
      .channel('stored_files')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stored_files' }, fetchFiles)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(import.meta.env.VITE_IPFS_API_URL + '/api/v0/add', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user) throw new Error('User not authenticated');

      const { error } = await supabase.from('stored_files').insert({
        user_address: userData.user.id,
        file_name: file.name,
        file_size: file.size,
        ipfs_cid: result.Hash,
        mime_type: file.type,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('stored_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Your Files</h2>
          <p className="text-sm text-gray-500">Manage and organize your stored files</p>
        </div>
        <label className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 cursor-pointer">
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Upload Files'}
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          {files.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No files uploaded yet</p>
          ) : (
            files.map((file) => (
              <FileRow key={file.id} file={file} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Files;