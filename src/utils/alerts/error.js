// src/alerts/error.js
import Swal from 'sweetalert2';

export const showErrorAlert = (title, text) => {
  Swal.fire({
    title: title || 'Error!',
    text: text || 'Something went wrong.',
    icon: 'error',
    confirmButtonText: 'Try Again',
  });
};