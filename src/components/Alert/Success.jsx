import PropTypes from "prop-types";
import Swal from "sweetalert2";
import React from "react";

const Success = (props) => {
  const displaySuccess = () => {

    let successMessage = "";

    if (typeof props.success.rawLog === "string") {
      switch (true) {
        case props.success.rawLog.includes("deleted_post"):
          successMessage = "Post successfully deleted.\n";
          break;
        case props.success.rawLog.includes("created_section"):
          successMessage = "Community successfully created.\n";
          break;
      }
    }

    Swal.fire({
      icon: "success",
      title: successMessage,
      showConfirmButton: true,
      timer: 1500
    });
  };

  React.useEffect(() => {
    if (props.success) {
      displaySuccess();
    }
  }, [props.success]);

  return null;
};

Success.propTypes = {
  success: PropTypes.object.isRequired
};

export default Success;