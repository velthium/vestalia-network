import Error from "@/components/Error";
import PropTypes from "prop-types";
import React from "react";

function NotFound(props) {
  return (
    <Error message="404 - Page not found." />
  );
}

NotFound.propTypes = {
  message: PropTypes.string.isRequired
};

export default NotFound;