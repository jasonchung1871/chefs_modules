export interface FileUploadOptions {
  url: string;
  fileKey: string;
  multiple: boolean;
  onProgress?: (file: File, progress: number) => void;
  onError?: (file: File, error: string) => void;
  onSuccess?: (file: File, response: any) => void;
}

export class SimpleFileUploader {
  private options: FileUploadOptions;

  constructor(options: FileUploadOptions) {
    this.options = options;
  }

  async uploadFiles(files: FileList | File[]): Promise<any[]> {
    const filesToUpload = this.options.multiple 
      ? Array.from(files) 
      : Array.from(files).slice(0, 1);

    const uploadPromises = filesToUpload.map(file => this.uploadSingleFile(file));
    return Promise.all(uploadPromises);
  }

  private async uploadSingleFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append(this.options.fileKey, file);
    formData.append('fileName', file.name);

    try {
      const response = await fetch(this.options.url, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      if (!response.ok) {
        const errorMessage = this.getErrorMessage(response.status);
        this.options.onError?.(file, errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const fileInfo = {
        storage: 'chefs',
        name: data.originalname,
        originalName: file.name,
        url: `${this.options.url}/${data.id}`,
        size: data.size,
        type: data.mimetype,
        data: { id: data.id },
      };

      this.options.onSuccess?.(file, fileInfo);
      return fileInfo;

    } catch (error) {
      const errorMessage = error.message || 'An unexpected error occurred during file upload.';
      this.options.onError?.(file, errorMessage);
      throw error;
    }
  }

  private getErrorMessage(status: number): string {
    switch (status) {
      case 409:
        return 'File did not pass the virus scanner.';
      case 400:
        return 'File could not be uploaded.';
      default:
        return 'An unexpected error occurred during file upload.';
    }
  }
}
