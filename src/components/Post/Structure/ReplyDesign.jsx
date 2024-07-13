import React, { useContext, useEffect, useState } from "react";
import Downvote from "./Downvote";
import Upvote from "./Upvote";
import Delete from "./Delete";
import FetchProfile from "@/utils/Desmos/fetchProfile";
import Share from "./Share";
import { AuthContext } from "@/contexts/Auth";
import GetIpfs from "@/utils/Ipfs/Get";
import PropTypes from "prop-types";
import Dropdown from 'react-bootstrap/Dropdown';

const CustomToggle = React.forwardRef(({ children, onClick }, ref) => (
  <a href="" ref={ref} onClick={(e) => { e.preventDefault(); onClick(e); }}>
    {children}
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-three-dots" viewBox="0 0 16 16">
      <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"/>
    </svg>
  </a>
));

function ReplyDesign({ index, post_page, post }) {
  const [userNickname, setUserNickname] = useState(null);
  const { authData } = useContext(AuthContext);
  const [textpost, setTextpost] = useState();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ipfsContent, profile] = await Promise.all([
          GetIpfs(post.post_urls[0].url),
          FetchProfile(post.owner_address)
        ]);

        setTextpost(ipfsContent);
        setUserNickname(profile.nickname);
      } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
      }
    };

    fetchData();
  }, [post.owner_address, post.post_urls]);

  const postUrl = `/community/${post.subspace_section.id}/${post.subspace_section.name.replace(/\s/g, "")}/${post.id}`;

  const renderPostContent = () => (
    <>
      <p className="h8 my-1"><strong>@{userNickname}</strong></p>
      <h2 className="h6 fw-bold">{post.text}</h2>
      {textpost}
    </>
  );

  return (
    <div key={index} className="border p-2 m-2 bg-white text-start">
      <div className="d-flex justify-content-between">
        {post_page ? renderPostContent() : (
          <a className="text-decoration-none" href={postUrl}>
            {renderPostContent()}
          </a>
        )}
        {authData.walletSigner && (
          <Dropdown>
            <Dropdown.Toggle as={CustomToggle} id="dropdown-custom-components" />
            <Dropdown.Menu>
              <Dropdown.Item as="button">
                <Delete postId={post.id} />
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        )}
      </div>
      <div className="d-flex flex-wrap">
        <div className="d-flex post-buttons my-1">
          <Upvote postId={post.id} postReactions={post.reactions} />
          <Downvote postId={post.id} postReactions={post.reactions} />
        </div>
        <Share postId={post.id} />
      </div>
    </div>
  );
}

ReplyDesign.propTypes = {
  index: PropTypes.number.isRequired,
  post_page: PropTypes.bool.isRequired,
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

export default ReplyDesign;
