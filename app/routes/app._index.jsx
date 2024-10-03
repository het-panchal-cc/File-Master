import {
  Box,
  Button,
  Layout,
  Text,
  ProgressBar,
  Page,
  LegacyCard,
  EmptyState,
  Card,
  Frame,
  Toast, // Import Toast
} from "@shopify/polaris";
import app_logo from "../assets/logo1.jpg";
import { useState } from "react";
import { useLoaderData } from "@remix-run/react";
import JSZip from "jszip";
import pkg from "file-saver";
const { saveAs } = pkg;
import { authenticate } from "../shopify.server";
import { ImportIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // GraphQL query to fetch all media types (MediaImage, Video, ExternalVideo, Model3d, GenericFile)
  const response = await admin.graphql(`
    query {
      shop {
        id
        name
        email
        myshopifyDomain
      }
      files(first: 50) {
        edges {
          node {
            ... on MediaImage {
              id
              image {
                url
              }
            }
            ... on Video {
              id
              alt
              originalSource {
                url
              }
            }
            ... on ExternalVideo {
              id
              alt
              embedUrl
            }
            ... on Model3d {
              id
              alt
              preview {
                image {
                  originalSrc
                }
              }
            }
            ... on GenericFile {
              id
              alt
              url
              mimeType
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `);

  const responseBody = await response.json();
  const shopData = responseBody.data.shop;
  let files = responseBody.data.files.edges;

  // Paginate if there are more media files
  let hasNextPage = responseBody.data.files.pageInfo.hasNextPage;
  let endCursor = responseBody.data.files.pageInfo.endCursor;

  while (hasNextPage) {
    const nextPageResponse = await admin.graphql(`
      query {
        files(first: 50, after: "${endCursor}") {
          edges {
            node {
              ... on MediaImage {
                id
                image {
                  url
                }
              }
              ... on Video {
                id
                alt
                originalSource {
                  url
                }
              }
              ... on ExternalVideo {
                id
                alt
                embedUrl
              }
              ... on Model3d {
                id
                alt
                preview {
                  image {
                    originalSrc
                  }
                }
              }
              ... on GenericFile {
                id
                alt
                url
                mimeType
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `);

    const nextPageResponseBody = await nextPageResponse.json();
    files = files.concat(nextPageResponseBody.data.files.edges);
    hasNextPage = nextPageResponseBody.data.files.pageInfo.hasNextPage;
    endCursor = nextPageResponseBody.data.files.pageInfo.endCursor;
  }

  return { shopData, files };
};

export default function AdditionalPage() {
  const { shopData, files } = useLoaderData();
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showToast, setShowToast] = useState(false); // State for showing toast

  const handleDownload = async () => {
    setIsDownloading(true);
    const zip = new JSZip();

    // Create the main folder 'shopify' to store subfolders
    const shopifyFolder = zip.folder(`${shopData.name}`);
    const imageFolder = shopifyFolder.folder("images");
    const videoFolder = shopifyFolder.folder("videos");
    const fileFolder = shopifyFolder.folder("files");

    // Add each media file to the appropriate folder
    const fetchPromises = files.map(({ node }, index) => {
      let fileUrl = "";
      let fileName = `file_${index}`; // Default file name

      // Determine the media type and set the URL and folder accordingly
      if (node.image?.url) {
        fileUrl = node.image.url;
        fileName = `${shopData.name}_image_${index}.jpg`;
        return fetch(fileUrl)
          .then((response) => response.blob())
          .then((blob) => {
            imageFolder.file(fileName, blob); // Save in the 'images' folder
            setDownloadProgress(((index + 1) / files.length) * 100);
          });
      } else if (node.originalSource?.url) {
        fileUrl = node.originalSource.url;
        fileName = `${shopData.name}_video_${index}.mp4`; // Assuming video is mp4
        return fetch(fileUrl)
          .then((response) => response.blob())
          .then((blob) => {
            videoFolder.file(fileName, blob); // Save in the 'videos' folder
            setDownloadProgress(((index + 1) / files.length) * 100);
          });
      } else if (node.embedUrl) {
        fileUrl = node.embedUrl;
        fileName = `${shopData.name}_external_${index}.url`; // Save embed URLs as text files
        return fetch(fileUrl)
          .then((response) => response.blob())
          .then((blob) => {
            fileFolder.file(fileName, blob); // Save in the 'files' folder
            setDownloadProgress(((index + 1) / files.length) * 100);
          });
      } else if (node.preview?.image?.originalSrc) {
        fileUrl = node.preview.image.originalSrc;
        fileName = `${shopData.name}_model3d_${index}.png`; // Save 3D model previews as PNGs
        return fetch(fileUrl)
          .then((response) => response.blob())
          .then((blob) => {
            imageFolder.file(fileName, blob); // Save in the 'images' folder
            setDownloadProgress(((index + 1) / files.length) * 100);
          });
      } else if (node.url) {
        // Handle generic files (e.g., TTF, PDF)
        fileUrl = node.url;
        const mimeType = node.mimeType.split("/")[1]; // Extract the file type from mimeType
        fileName = `${shopData.name}_file_${index}.${mimeType}`;
        return fetch(fileUrl)
          .then((response) => response.blob())
          .then((blob) => {
            fileFolder.file(fileName, blob); // Save in the 'files' folder
            setDownloadProgress(((index + 1) / files.length) * 100);
          });
      }
    });

    await Promise.all(fetchPromises);

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${shopData.name}-media.zip`);

    setIsDownloading(false);
    setShowToast(true); // Show the toast when download completes
  };

  const toggleToast = () => setShowToast(false); // Function to close toast

  return (
    <Page title="FileMaster - Exporter">
      <Frame>
        <Layout>
          <Layout.Section>
            <LegacyCard sectioned>
              <EmptyState
                heading="Welcome to FileMaster - Exporter"
                action={{
                  icon: ImportIcon,
                  content: isDownloading ? "Downloading..." : "Export Files",
                  onAction: handleDownload,
                  disabled: isDownloading,
                }}
                image={app_logo}
                alt="main_ScriptInjectorp"
                style={{
                  maxWidth: 100,
                  height: 70,
                  borderRadius: 5,
                  boxShadow:
                    "0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)",
                }}
              >
                <Text as="p">
                  FileMaster makes it easy to download all your media files
                  (images, videos, 3D models, etc.) from your Shopify admin.
                  Simply click the button below, and FileMaster will start
                  exporting your files. Please keep this browser window open
                  during the process.
                </Text>
              </EmptyState>
            </LegacyCard>
          </Layout.Section>

          <Layout.Section>
            {isDownloading && (
              <Card background="bg-surface-secondary">
                <div>
                  <ProgressBar
                    progress={downloadProgress}
                    size="medium"
                    tone="primary"
                  />
                  <Text>{`Download in progress: ${Math.round(downloadProgress)}%`}</Text>
                </div>
              </Card>
            )}
          </Layout.Section>
        </Layout>
        {showToast && (
          <Toast
            content="Files downloaded successfully!"
            onDismiss={toggleToast}
          />
        )}{" "}
        {/* Toast Component */}
      </Frame>
    </Page>
  );
}
