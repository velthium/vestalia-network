// src/alerts/error.js
import Swal from 'sweetalert2';

export const showErrorAlert = (title, text) => {
  return Swal.fire({
    title: title || 'Error!',
    text: text || 'Something went wrong.',
    icon: 'error',
    width: '50%',
    confirmButtonText: 'Try Again',
    customClass: {
      htmlContainer: 'lh-base'
    },
  });
};