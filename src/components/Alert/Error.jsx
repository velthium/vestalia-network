import PropTypes from "prop-types";
import Swal from "sweetalert2";
import React from "react";

const Error = (props) => {
  const displayError = () => {
    let errorMessage = "An unexpected error occurred";
    console.log(props);
    if (typeof props.error.message === "string") {
      switch (true) {
        case props.error.message.includes("has already been created"):
          errorMessage = "Account with this DTag already exists.";
          break;
        case props.error.message.includes("it should match the following regEx."):
          errorMessage = "Please enter valid characters.";
          break;
        case props.error.message.includes("cannot be less"):
          errorMessage = "Profile dtag cannot be less than 6 characters.";
          break;
        case props.error.message.includes("Request rejected"):
          errorMessage = "Error: Request rejected by the user.";
          break;
        case props.error.message.includes("Keplr + Ledger is currently not supported"):
          errorMessage = "Keplr + Ledger is currently not supported.";
          break;
        case props.error.message.includes("Cannot read properties of undefined (reading 'post')"):
          errorMessage = "Post not found.";
          break;
        case props.error.message.includes("section: permissions denied"):
          errorMessage = "Permissions denied";
          break;
        case props.error.message.includes("Cannot read properties of undefined (reading 'Name')"):
          errorMessage = "IPFS upload error";
          break;
      }
    }

    Swal.fire({
      icon: "error",
      title: errorMessage,
      showConfirmButton: false,
      timer: 1500
    });
  };

  React.useEffect(() => {
    if (props.error) {
      displayError();
    }
  }, [props.error]);

  return null;
};

Error.propTypes = {
  error: PropTypes.object.isRequired
};

export default Error;