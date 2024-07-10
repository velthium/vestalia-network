import PropTypes from "prop-types";
import React from "react";

function Error(props) {
  return (
    <div className="h-100 d-flex flex-column align-items-center justify-content-center">
      <div className="mt-5">
        <p className="h2 mb-5 text-center">404 - Page not found.</p>
        <img
          src="/images/AlexandriaLibrary.webp"
          alt="Library of Alexandria" />
      </div>
    </div>
  );
}

Error.propTypes = {
  message: PropTypes.string.isRequired
};

export default Error;