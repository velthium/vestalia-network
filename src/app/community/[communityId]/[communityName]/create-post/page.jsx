"use client";

import PageTitle from "@/components/Title";
import PostCreator from "@/components/Post/Create";
import React from "react";
import { useParams } from "next/navigation";

function CreatePost() {
  const { communityId, communityName } = useParams();

  return (
    <div>
      <PageTitle title="Create Post" />
      <PostCreator status="create" communityId={communityId} communityName={communityName} />
    </div>
  );
}

export default CreatePost;
