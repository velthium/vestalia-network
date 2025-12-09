import Swal from 'sweetalert2';

// Toast notification (top-right corner)
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  }
});

// Loading toast (no auto-close)
const LoadingToast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  }
});

// Toast notifications
export const showSuccessToast = (title) => Toast.fire({ icon: 'success', title: title || 'Success!' });
export const showErrorToast = (title) => Toast.fire({ icon: 'error', title: title || 'Error!' });
export const showInfoToast = (title) => Toast.fire({ icon: 'info', title: title || 'Info' });
export const showLoadingToast = (title) => LoadingToast.fire({ 
  title: title || 'Loading...', 
  didOpen: () => { Swal.showLoading(); }
});
export const closeToast = () => Swal.close();

// Modal alert (centered)
export const showSuccessAlert = (title, text) => Swal.fire({ title: title || 'Success!', text: text || 'The action was successful.', icon: 'success', confirmButtonText: 'Cool' });