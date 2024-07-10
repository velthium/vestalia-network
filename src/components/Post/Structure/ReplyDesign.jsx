import React, { useContext, useEffect, useState } from "react";
import Downvote from "./Downvote";
import Upvote from "./Upvote";
import Delete from "./Delete";
import GetProfile from "@/utils/Desmos/getProfile";
import Share from "./Share";
import { AuthContext } from "@/contexts/Auth";
import GetIpfs from "@/utils/Ipfs/Get";
import PropTypes from "prop-types";

function ReplyDesign(props) {
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
    <div
      key={props.index}
      className="border p-2 m-2 bg-white text-start">
      {props.post_page ? (
        <React.Fragment>
          <h2 className="h6 fw-bold">{props.post.text}</h2>
          <p className="h8 my-1">@{userNickname}</p>
          <p className="h8 my-1">{props.post.subspace_section.name}</p>
          {textpost}
        </React.Fragment>
      ) : (
        <a
          className="text-decoration-none"
          href={`/community/${props.post.subspace_section.id}/${props.post.subspace_section.name.replace(/\s/g, "")}/${props.post.id}`}>
          <p className="h8 my-1">@{userNickname}</p>
          <h2 className="h6 fw-bold">{props.post.text}</h2>
          {textpost}
        </a>
      )}
      <div className="d-flex flex-wrap">
        <div className="d-flex post-buttons my-1">
          <Upvote
            postId={props.post.id}
            postReactions={props.post.reactions} />
          <Downvote
            postId={props.post.id}
            postReactions={props.post.reactions} />
        </div>
        <Share postId={props.post.id} />
        {authData.walletSigner && (
          <Delete postId={props.post.id} />
        )}
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
      name: PropTypes.string.isRequired
    }).isRequired,
    post_urls: PropTypes.shape({
      url: PropTypes.array.isRequired
    }).isRequired,
    reactions: PropTypes.shape({
      url: PropTypes.string.isRequired
    }).isRequired
  }).isRequired
};

export default ReplyDesign;