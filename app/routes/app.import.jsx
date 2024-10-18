import { useState } from 'react';
import { Page, Button, Card, Thumbnail } from "@shopify/polaris";
const UPLOAD_MUTATION = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
    }
  }
`;
const generateUploadTarget = async (fileName, mimeType) => {

    const input = [
        {
            resource: "FILE",
            filename: fileName,
            mimeType: mimeType,
            httpMethod: "POST",
        },
    ];
    console.log(input, "product name")
    const response = await admin.graphql(UPLOAD_MUTATION, {
        variables: { input: input },
    });
    console.log(response, "responce show")
    const result = await response.json();
    return result.data.stagedUploadsCreate.stagedTargets[0];
};
export default function FileUploadPage() {
    const [files, setFiles] = useState([]);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [error, setError] = useState('');


    const handleFileInputChange = (event) => {
        const selectedFiles = Array.from(event.target.files);
        setFiles(selectedFiles);

    };



    const uploadFile = async (file, uploadTarget) => {
        const formData = new FormData();

        uploadTarget.parameters.forEach((param) => {
            formData.append(param.name, param.value);
        });

        formData.append('file', file);

        const response = await fetch(uploadTarget.url, {
            method: 'POST',
            body: formData,
        });

        return response.ok ? uploadTarget.resourceUrl : null;
    };

    const handleUploadClick = async () => {
        if (files.length === 0) {
            setError('Please select a file to upload.');
            return;
        }

        setError('');
        const uploadedUrls = [];

        for (const file of files) {
            try {
                const uploadTarget = await generateUploadTarget(file.name, file.type);
                const resourceUrl = await uploadFile(file, uploadTarget);

                if (resourceUrl) {
                    uploadedUrls.push(resourceUrl);
                } else {
                    setError(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error('Error uploading file:', err);
                setError(`An error occurred while uploading ${file.name}`);
            }
        }
        setUploadedFiles(uploadedUrls);

    };

    return (
        <Page title="Upload and Display Images">
            <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInputChange}
                style={{ marginTop: '20px' }}
            />

            <Button primary onClick={handleUploadClick} style={{ marginTop: '20px' }}>
                Upload File
            </Button>

            {error && <p style={{ color: 'red' }}>{error}</p>}

            {uploadedFiles.length > 0 && (
                <Card title="Uploaded Images" sectioned>
                    {uploadedFiles.map((fileUrl, index) => (
                        <Thumbnail
                            key={index}
                            source={fileUrl}
                            alt={`Uploaded image ${index + 1}`}
                            size="large"
                        />
                    ))}
                </Card>
            )}
        </Page>
    );
}
