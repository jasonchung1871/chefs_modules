/* tslint:disable */
import { Components, Utils } from 'formiojs';
const ParentComponent = (Components as any).components.file;
import editForm from './Component.form';
import { Constants } from '../Common/Constants';
import { SimpleFileUploader } from './FileUploader';
import uniqueName = Utils.uniqueName;

const ID = 'simplefile';
const DISPLAY = 'File Upload';

export default class Component extends ParentComponent {
  static schema(...extend) {
    return ParentComponent.schema(
      {
        type: ID,
        label: DISPLAY,
        key: ID,
        storage: 'chefs',
        url: '/files',
        fileKey: 'files',
        fileNameTemplate: '{{fileName}}',
        image: false,
        webcam: false,
        webcamSize: 320,
        privateDownload: false,
        imageSize: '200',
        filePattern: '',
        fileMinSize: '0KB',
        fileMaxSize: '1GB',
        uploadOnly: false,
        customClass: 'formio-component-file',
      },
      ...extend
    );
  }

  public static readonly editForm = editForm;

  static get builderInfo() {
    return {
      title: DISPLAY,
      group: 'simple',
      icon: 'file',
      weight: 13,
      documentation: Constants.DEFAULT_HELP_LINK,
      schema: Component.schema(),
    };
  }

  // we will read these in from runtime
  private readonly _enabled: boolean;

  constructor(...args) {
    super(...args);
    if (this.options?.componentOptions) {
      // componentOptions are passed in from the viewer, basically runtime configuration
      const opts = this.options.componentOptions[ID];
      this.component.options = { ...this.component.options, ...opts };
      // the config.uploads object will say what size our server can handle and what path to use.
      if (opts?.config?.uploads) {
        const remSlash = (s) => s.replace(/^(\s*\/?\s*)$|^(\s*\/?\s*)$/gm, '');

        const cfg = opts.config;
        const uploads = cfg.uploads;

        this.component.fileMinSize = uploads.fileMinSize;
        this.component.fileMaxSize = uploads.fileMaxSize;
        // set the default url to be for uploads.
        this.component.url = cfg.overrideDomain ? cfg.overrideDomain : `/${remSlash(cfg.basePath)}/${remSlash(
          cfg.apiPath
        )}/${remSlash(uploads.path)}`;
        // no idea what to do with this yet...
        this._enabled = uploads.enabled;
      }
    }
  }

  deleteFile(fileInfo) {
    const { options = {} } = this.component;
    if (fileInfo) {
      options.deleteFile(fileInfo);
    }
  }

  upload(files) {
    // Only allow one upload if not multiple.
    if (!this.component.multiple) {
      files = Array.prototype.slice.call(files, 0, 1);
    }
    
    if (!this.component || !files?.length) {
      return;
    }

    // Create uploader instance
    const uploader = new SimpleFileUploader({
      url: this.interpolate(this.component.url),
      fileKey: this.component.fileKey ?? 'file',
      multiple: this.component.multiple,
      onProgress: (file, progress) => {
        const fileUpload = this.findFileStatus(file);
        if (fileUpload) {
          fileUpload.status = 'progress';
          fileUpload.progress = progress;
          delete fileUpload.message;
          this.redraw();
        }
      },
      onError: (file, error) => {
        const fileUpload = this.findFileStatus(file);
        if (fileUpload) {
          fileUpload.status = 'error';
          fileUpload.message = this.t(error);
          delete fileUpload.progress;
          this.redraw();
        }
      },
      onSuccess: (file, fileInfo) => {
        const fileUpload = this.findFileStatus(file);
        if (fileUpload) {
          const index = this.statuses.indexOf(fileUpload);
          if (index !== -1) {
            this.statuses.splice(index, 1);
          }
        }
        
        if (!this.hasValue()) {
          this.dataValue = [];
        }
        this.dataValue.push(fileInfo);
        this.redraw();
        this.triggerChange();
      }
    });

    // Process each file with validation
    Array.prototype.forEach.call(files, async (file) => {
      const fileName = uniqueName(
        file.name,
        this.component.fileNameTemplate,
        this.evalContext()
      );
      
      const fileUpload = {
        originalName: file.name,
        name: fileName,
        size: file.size,
        status: 'info',
        message: this.t('Starting upload'),
      };

      // Validation logic (keeping your existing validation)
      const validationError = this.validateFile(file);
      if (validationError) {
        fileUpload.status = 'error';
        fileUpload.message = this.t(validationError);
        this.statuses.push(fileUpload);
        this.redraw();
        return;
      }

      this.statuses.push(fileUpload);
      this.redraw();

      try {
        await uploader.uploadFiles([file]);
      } catch (error) {
        // Error handling is done in the onError callback
      }
    });
  }

  private findFileStatus(file: File) {
    return this.statuses.find(status => status.originalName === file.name);
  }

  private validateFile(file: File): string | null {
    const fileNameLower = file.name.toLowerCase();
    const systemBlockedExtensions = [
      '.exe', '.bat', '.scr', '.com', '.pif', '.cmd', '.jar', '.app',
      '.deb', '.dmg', '.msi', '.run', '.bin', '.sh', '.ps1', '.vbs',
      '.js', '.html', '.php', '.py', '.rb',
    ];

    if (systemBlockedExtensions.some((ext) => fileNameLower.endsWith(ext))) {
      return 'This file type is not supported for security reasons.';
    }

    // Check file pattern
    const pattern = this.component.filePattern ?? undefined;
    if (pattern && !this.validatePattern(file, pattern)) {
      return `File type not allowed. Supported: ${this.component.filePattern}`;
    }

    // Check file minimum size
    if (this.component.fileMinSize && !this.validateMinSize(file, this.component.fileMinSize)) {
      return `File is too small; it must be at least ${this.component.fileMinSize}`;
    }

    // Check file maximum size
    if (this.component.fileMaxSize && !this.validateMaxSize(file, this.component.fileMaxSize)) {
      return `File is too big; it must be at most ${this.component.fileMaxSize}`;
    }

    return null;
  }

  getFile(fileInfo) {
    const fileId = fileInfo?.data?.id ?? fileInfo.id;
    const { options = {} } = this.component;
    options.getFile(fileId, { responseType: 'blob' }).catch((response) => {
      // Is alert the best way to do this?
      // User is expecting an immediate notification due to attempting to download a file.
      alert(response);
    });
  }
}
