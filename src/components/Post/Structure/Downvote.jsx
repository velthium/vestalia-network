import { RegisteredReactionValue } from "@desmoslabs/desmjs-types/desmos/reactions/v1/models";
import SuccessAlert from "@/components/Alert/Success";
import Keplr from "@/utils/Wallet/Keplr";
import ErrorAlert from "@/components/Alert/Error";
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

function Downvote(props) {
  const [upVotesCounter, setUpVotesCounter] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [liked, setLiked] = useState(false);

  const postId = props.postId;

  useEffect(() => {
    for (const key in props.postReactions) {
      if (props.postReactions[key].value && props.postReactions[key].value.registered_reaction_id === 5) {
        setUpVotesCounter(upVotesCounter + 1);
      }
    }
  }, [props.postReactions]);

  const handleToggleDownvote = async () => {
    setIsLiking(true);
    try {
      const keplrData = await Keplr();

      const downVoteReaction = {
        typeUrl: "/desmos.reactions.v1.RegisteredReactionValue",
        value: RegisteredReactionValue.encode({
          registeredReactionId: 5
        }).finish()
      };

      const addReaction = {
        typeUrl: "/desmos.reactions.v1.MsgAddReaction",
        value: {
          user: keplrData.signer.accountData.address,
          subspaceId: 21,
          postId,
          value: downVoteReaction
        }
      };

      const result = await keplrData.signAndBroadcast(addReaction.value.user, [addReaction], "auto");

      setSuccess(result);

      setLiked(!liked);
    } catch (err) {
      setError(err);
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <div className="">
      <button
        className="d-flex p-0 btn"
        onClick={handleToggleDownvote}
        disabled={isLiking}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          className="align-self-center bi bi-caret-down-square"
          viewBox="0 0 16 16">
          <path d="M3.626 6.832A.5.5 0 0 1 4 6h8a.5.5 0 0 1 .374.832l-4 4.5a.5.5 0 0 1-.748 0z"/>
          <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1z"/>
        </svg>
        <p className="mx-2 mb-0">{upVotesCounter}</p>
      </button>

      {success && <SuccessAlert success={success} />}
      {error && <ErrorAlert error={error} />}
    </div>
  );
}

Downvote.propTypes = {
  postId: PropTypes.number.isRequired,
  postReactions: PropTypes.array.isRequired
};

export default Downvote;