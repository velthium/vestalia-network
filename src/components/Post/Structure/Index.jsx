import React, { useContext, useEffect, useState } from "react";
import Downvote from "./Downvote";
import Comment from "./Comment";
import Upvote from "./Upvote";
import Delete from "./Delete";
import Edit from "./Edit"; // Assurez-vous d'avoir un composant Edit si nécessaire
import Share from "./Share";
import { AuthContext } from "@/contexts/Auth";
import GetIpfs from "@/utils/Ipfs/Get";
import PropTypes from "prop-types";
import GetProfile from "@/utils/Desmos/getProfile";
import Dropdown from 'react-bootstrap/Dropdown'; // Assurez-vous d'avoir installé react-bootstrap et bootstrap

// Custom toggle component
const CustomToggle = React.forwardRef(({ children, onClick }, ref) => (
  <a
    href=""
    ref={ref}
    onClick={(e) => {
      e.preventDefault();
      onClick(e);
    }}
  >
    {children}
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-three-dots" viewBox="0 0 16 16">
      <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"/>
    </svg>
  </a>
));

function Post(props) {
  const [userNickname, setUserNickname] = useState(null);
  const { authData } = useContext(AuthContext);
  const [textpost, setTextpost] = useState();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ipfsContent = await GetIpfs(props.post.post_urls[0].url);
        setTextpost(ipfsContent);
      } catch (error) {
        console.error("Erreur lors de la récupération des données depuis IPFS :", error);
      }
    };

    fetchData();

    const fetchProfile = async () => {
      try {
        const profile = await GetProfile(props.post.owner_address);
        setUserNickname(profile.nickname);
      } catch (error) {
        console.error("Erreur lors de la récupération du profil :", error);
      }
    };

    fetchProfile();
  }, [props.post.owner_address]);

  return (
    <div key={props.index} className="border p-2 m-2 bg-white text-start">
      {props.from_page === "post_page" ? (
        <React.Fragment>
          <div className="d-flex justify-content-between">
            <p className="h8 my-1"><strong>@{userNickname}</strong> on s/{props.post.subspace_section.name}</p>
            {authData.walletSigner && (
              <Dropdown>
                <Dropdown.Toggle as={CustomToggle} id="dropdown-custom-components" />
                <Dropdown.Menu>
                  <Dropdown.Item as="button">
                    <Edit postId={props.post.id} />
                    <Delete postId={props.post.id} />
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            )}
          </div>
          <h2 className="h5 fw-bold">{props.post.text}</h2>
          {textpost}
        </React.Fragment>
      ) : (
        <a
          className="text-decoration-none"
          href={`/community/${props.post.subspace_section.id}/${props.post.subspace_section.name.replace(/\s/g, "")}/${props.post.id}`}
        >
          {props.from_page !== "community_page" ? (
            <p className="h8 my-1"><strong>@{userNickname}</strong> on <span className="custom-orange">s/{props.post.subspace_section.name}</span></p>
          ) : <p className="h8 my-1">u/{userNickname}</p>}
          <h2 className="h5 fw-bold">{props.post.text}</h2>
          {textpost}
        </a>
      )}
      <div className="d-flex flex-wrap">
        <div className="d-flex post-buttons my-1">
          <Upvote postId={props.post.id} postReactions={props.post.reactions} />
          <Downvote postId={props.post.id} postReactions={props.post.reactions} />
        </div>
        <Comment postId={props.post.id} />
        <Share postId={props.post.id} />
      </div>
    </div>
  );
}

Post.propTypes = {
  index: PropTypes.number.isRequired,
  from_page: PropTypes.string.isRequired,
  post: PropTypes.shape({
    owner_address: PropTypes.string.isRequired,
    id: PropTypes.number.isRequired,
    text: PropTypes.string.isRequired,
    subspace_section: PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
    }).isRequired,
    post_urls: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string.isRequired,
      })
    ).isRequired,
    reactions: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string.isRequired,
      })
    ).isRequired,
  }).isRequired,
};

export default Post;
