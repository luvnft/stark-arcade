'use client';
import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Icon,
  Input,
  Text,
  Textarea,
  useDisclosure,
  VStack,
  Image,
  Flex,
  Collapse,
  useToast,
} from '@chakra-ui/react';
import React from 'react';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import ArrowIcon from '@/public/assets/icons/arrow.svg';
import CloseIcon from '@/public/assets/icons/logout.svg';
import UploadImage from '@/components/UploadImage';
import { Switch } from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { axiosHandlerNoBearer } from '@/config/axiosConfig';
import { Select } from 'chakra-react-select';
import { uploadFileIPFS } from '@/utils/helper';
import { CONTRACT_ADDRESS, tokenInfos } from '@/utils/constants';
import { SelectReactCustom } from '@/themes';
interface IGameSubmitProps {
  name: string;
  email: string;
  shortDescription: string;
  longDescription: string;
  gameUrl: string;
  banner: any;
  logo: any;
  sourceUrl: string;
  tokens?: any[];
  totalSupply?: number;
}
interface IProps {
  cancelSubmit: () => void;
}
declare module 'yup' {
  interface MixedSchema {
    fileSize(width: number, height: number, message: string): this;
    imageDimensionCheck(
      message: string,
      requiredWidth: number,
      requiredHeight: number
    ): this;
  }
}

const SubmitGameForm = ({ cancelSubmit }: IProps) => {
  const inititalValues: IGameSubmitProps = {
    name: '',
    shortDescription: '',
    longDescription: '',
    email: '',
    gameUrl: '',
    banner: undefined,
    logo: undefined,
    sourceUrl: '',
    tokens: [
      { value: CONTRACT_ADDRESS.STRK, label: 'STRK' },
      { value: CONTRACT_ADDRESS.ETH, label: 'ETH' },
    ],
    totalSupply: 0,
  };
  Yup.addMethod(Yup.mixed, 'fileRequired', function (message) {
    return this.test('fileRequired', message, function (value) {
      const { path, createError } = this;
      if (!value) {
        return createError({ path, message });
      }
      return true;
    });
  });
  const imageWidthAndHeight = (
    file: File
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        const img = new window.Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
          reject(new Error('Failed to load image.'));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file.'));
      };
      reader.readAsDataURL(file);
    });
  };
  Yup.addMethod<Yup.MixedSchema>(
    Yup.mixed,
    'imageDimensionCheck',
    function (message: string, requiredWidth: number, requiredHeight: number) {
      return this.test(
        'image-dimension-check',
        message,
        async function (value: any) {
          // use `any` for the value type
          const { path, createError } = this;

          if (!value) {
            return true; // No file provided, so validation passes
          }

          if (!(value instanceof File)) {
            return createError({
              path,
              message: 'The provided value is not a valid file.',
            });
          }

          try {
            const imgDimensions = await imageWidthAndHeight(value);

            if (imgDimensions.width !== requiredWidth) {
              return createError({
                path,
                message: `The file width needs to be ${requiredWidth}px!`,
              });
            }

            if (imgDimensions.height !== requiredHeight) {
              return createError({
                path,
                message: `The file height needs to be ${requiredHeight}px!`,
              });
            }

            return true;
          } catch (error) {
            return createError({
              path,
              message: 'Failed to validate image dimensions.',
            });
          }
        }
      );
    }
  );

  const validationSchema = Yup.object({
    name: Yup.string().required('Game name is required'),
    shortDescription: Yup.string()
      .required('Short description is required')
      .min(3, 'Short description must be at least 3 characters')
      .max(50, 'Short description must be at most 50 characters'),
    longDescription: Yup.string()
      .required('Long description is required')
      .min(3, 'Long description must be at least 3 characters')
      .max(255, 'Long description must be at most 50 characters'),
    gameUrl: Yup.string()
      .required('Game url is required')
      .url('Game URL must be a valid URL'),
    logo: (Yup as any)
      .mixed()
      .fileRequired('Game avatar is required')
      .imageDimensionCheck('The file width needs to be 300x300', 300, 300),
    banner: (Yup as any)
      .mixed()
      .fileRequired('Game banner is required')
      .imageDimensionCheck('The file width needs to be 1920x400', 1920, 400),
    sourceUrl: Yup.string()
      .required('Link source game is required')
      .url('Source URL must be a valid URL'),
  });
  const toast = useToast();
  const handleSubmitGame = useMutation({
    mutationFn: async (form: any) => {
      const { data } = await axiosHandlerNoBearer.post(
        '/starkarcade-hub/submit-game',
        form
      );
      return data;
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Error submitting game',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Game submitted successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    },
  });
  const { isOpen: isAdvance, onToggle: onToggleAdvance } = useDisclosure();
  const { isOpen: isOwnToken, onToggle: onToggleOwnToken } = useDisclosure();
  const formik = useFormik({
    initialValues: inititalValues,
    validationSchema: validationSchema,
    onSubmit: async values => {
      toast({
        title: 'Uploading files...',
        description: 'Your files are being uploaded.',
        status: 'info',
        duration: null, // Keep it visible until the upload is complete
        isClosable: false,
      });
      const dataLogoIPFS = await uploadFileIPFS(formik.values.logo);
      const dataBannerIPFS = await uploadFileIPFS(formik.values.banner);
      if (isAdvance && isOwnToken && values.tokens) {
        values.tokens = values.tokens.map((token: any) => token.value);
      }
      await handleSubmitGame.mutate({
        ...values,
        banner: `${process.env.NEXT_PUBLIC_GATEWAY_URL}/ipfs/${dataBannerIPFS}`,
        logo: `${process.env.NEXT_PUBLIC_GATEWAY_URL}/ipfs/${dataLogoIPFS}`,
      });
      toast({
        title: 'Uploading files...',
        description: 'Your files are being uploaded.',
        status: 'info',
        duration: null, // Keep it visible until the upload is complete
        isClosable: false,
      });
      formik.resetForm();
    },
  });

  return (
    <Box px={4}>
      <form onSubmit={formik.handleSubmit}>
        <VStack gap={6}>
          <FormControl
            variant="submit_game"
            isRequired
            isInvalid={!!(formik.touched.name && formik.errors.name)}
          >
            <FormLabel>Game Name</FormLabel>
            <Input
              variant="primary"
              type="text"
              placeholder="Ex: Starkarcade"
              id="name"
              value={formik.values.name}
              onChange={formik.handleChange}
            />
            {formik.touched.name && formik.errors.name && (
              <FormErrorMessage>
                <Text> {formik.errors.name as any}</Text>
              </FormErrorMessage>
            )}
          </FormControl>
          <FormControl
            variant="submit_game"
            isInvalid={!!(formik.touched.name && formik.errors.name)}
            isRequired
          >
            <FormLabel>Email Team</FormLabel>
            <Input
              variant="primary"
              type="text"
              id="email"
              placeholder="Ex: starkarcade@gmail.com"
              value={formik.values.email}
              onChange={e => {
                formik.handleChange(e);
                // updateFields({
                //   email: e.target.value,
                // });
              }}
            />
            {formik.touched.email && formik.errors.email && (
              <FormErrorMessage>
                <Text> {formik.errors.email as any}</Text>
              </FormErrorMessage>
            )}
          </FormControl>
          <FormControl
            variant="submit_game"
            isRequired
            isInvalid={!!(formik.touched.name && formik.errors.name)}
          >
            <FormLabel>Short Description</FormLabel>
            <Input
              variant="primary"
              type="text"
              id="shortDescription"
              placeholder="Ex: Short Description"
              value={formik.values.shortDescription}
              onChange={e => {
                formik.handleChange(e);
                // updateFields({
                //   shortDescription: e.target.value,
                // });
              }}
            />
            {formik.touched.shortDescription &&
              formik.errors.shortDescription && (
                <FormErrorMessage>
                  <Text> {formik.errors.shortDescription as any}</Text>
                </FormErrorMessage>
              )}
          </FormControl>
          <FormControl
            variant="submit_game"
            isInvalid={
              !!(
                formik.touched.longDescription && formik.errors.longDescription
              )
            }
            isRequired
          >
            <FormLabel>Long Description</FormLabel>

            <Textarea
              placeholder="Ex: LongDescription"
              variant="primary"
              id="longDescription"
              value={formik.values.longDescription}
              onChange={e => {
                formik.handleChange(e);
                // updateFields({
                //   longDescription: e.target.value,
                // });
              }}
            />
            {formik.touched.longDescription &&
              formik.errors.longDescription && (
                <FormErrorMessage>
                  <Text> {formik.errors.longDescription as any}</Text>
                </FormErrorMessage>
              )}
          </FormControl>
          <FormControl
            variant="submit_game"
            isRequired
            isInvalid={!!(formik.touched.name && formik.errors.name)}
          >
            <FormLabel>Game URL</FormLabel>
            <Input
              variant="primary"
              type="text"
              id="gameUrl"
              placeholder="Ex: Starkarcade"
              value={formik.values.gameUrl}
              onChange={e => {
                formik.handleChange(e);
                // updateFields({
                //   gameUrl: e.target.value,
                // });
              }}
            />
            {formik.touched.gameUrl && formik.errors.gameUrl && (
              <FormErrorMessage>
                <Text> {formik.errors.gameUrl as any}</Text>
              </FormErrorMessage>
            )}
          </FormControl>
          <FormControl
            variant="submit_game"
            isRequired
            isInvalid={!!(formik.touched.sourceUrl && formik.errors.sourceUrl)}
          >
            <FormLabel>Link Source Game</FormLabel>
            <Input
              variant="primary"
              type="text"
              id="sourceUrl"
              placeholder="Ex: Link Source Game"
              value={formik.values.sourceUrl}
              onChange={e => {
                formik.handleChange(e);
                // updateFields({
                //   sourceUrl: e.target.value,
                // });
              }}
            />
            {formik.touched.sourceUrl && formik.errors.sourceUrl && (
              <FormErrorMessage>
                <Text> {formik.errors.sourceUrl as any}</Text>
              </FormErrorMessage>
            )}
          </FormControl>

          <FormControl
            variant="submit_game"
            isRequired
            isInvalid={!!(formik.touched.logo && formik.errors.logo)}
          >
            <FormLabel>Game Avatar (300x300)</FormLabel>
            <Box
              padding={6}
              borderRadius="24px"
              background="shader.800"
              width="fit-content"
              position="relative"
              cursor="pointer"
              role="group"
            >
              {formik.values.logo && (
                <Image
                  src={URL.createObjectURL(formik.values.logo)}
                  h={300}
                  w={300}
                  objectFit="cover"
                  borderRadius="lg"
                  alt="Game Avatar"
                />
              )}

              <UploadImage
                imageFile={formik.values.logo}
                label="Game Logo"
                setImageFile={file => {
                  formik.handleChange({
                    target: { id: 'logo', value: file },
                  });
                  // updateFields({ logo: file });
                }}
              />
            </Box>

            {formik.touched.logo && formik.errors.logo && (
              <FormErrorMessage>
                <Text> {formik.errors.logo as any}</Text>
              </FormErrorMessage>
            )}
          </FormControl>

          <FormControl
            variant="submit_game"
            isRequired
            isInvalid={!!(formik.touched.banner && formik.errors.banner)}
          >
            <FormLabel>Game Banner (1920x400)</FormLabel>
            <Box
              padding={6}
              borderRadius="24px"
              background="shader.800"
              width="fit-content"
              position="relative"
              cursor="pointer"
              role="group"
            >
              {formik.values.banner && (
                <Image
                  src={URL.createObjectURL(formik.values.banner)}
                  objectFit="contain"
                  alt="Game Banner"
                  height={400}
                  borderRadius="lg"
                  width={1920}
                />
              )}
              <UploadImage
                imageFile={formik.values.banner}
                label="Game Banner"
                setImageFile={file => {
                  formik.handleChange({
                    target: { id: 'banner', value: file },
                  });
                }}
              />
            </Box>

            {formik.touched.banner && formik.errors.banner && (
              <FormErrorMessage>
                <Text> {formik.errors.banner as any}</Text>
              </FormErrorMessage>
            )}
          </FormControl>

          <Flex flexDirection="column" width="full" gap={4}>
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="advance" mb="0">
                Advanced (token if any)
              </FormLabel>
              <Switch id="advance" onChange={onToggleAdvance} />
            </FormControl>

            <Collapse
              in={isAdvance}
              animateOpacity
              style={{
                overflow: isAdvance ? 'visible' : 'hidden',
              }}
            >
              <Flex flexDirection="column" gap={6}>
                <FormControl
                  variant="submit_game"
                  isRequired={isAdvance}
                  isInvalid={
                    !!(formik.touched.totalSupply && formik.errors.totalSupply)
                  }
                >
                  <HStack justifyContent="space-between">
                    <FormLabel>Token Info</FormLabel>
                    <HStack mb={4}>
                      <Text
                        as={'label'}
                        htmlFor="ownToken"
                        style={{
                          fontSize: '12px',
                        }}
                      >
                        Use Own Token
                      </Text>
                      <Switch id="ownToken" onChange={onToggleOwnToken} />
                    </HStack>
                  </HStack>

                  {isOwnToken ? (
                    <Input placeholder="Type Contract Address" />
                  ) : (
                    <Select
                      isMulti
                      variant="outline"
                      chakraStyles={SelectReactCustom}
                      placeholder="Ex: STRK, ETH"
                      name="tokens"
                      options={tokenInfos as any}
                      value={formik.values.tokens}
                      onChange={e =>
                        formik.handleChange({
                          target: {
                            name: 'tokens',
                            value: e,
                          },
                        })
                      }
                    />
                  )}
                  {formik.touched.tokens && formik.errors.tokens && (
                    <FormErrorMessage>
                      <Text> {formik.errors.tokens as any}</Text>
                    </FormErrorMessage>
                  )}
                </FormControl>
                <FormControl
                  variant="submit_game"
                  isRequired={isAdvance}
                  isInvalid={
                    !!(formik.touched.totalSupply && formik.errors.totalSupply)
                  }
                >
                  <FormLabel>Total Supply</FormLabel>
                  <Input variant="primary" type="text" placeholder="Ex: 100" />
                  {formik.touched.totalSupply && formik.errors.totalSupply && (
                    <FormErrorMessage>
                      <Text> {formik.errors.totalSupply as any}</Text>
                    </FormErrorMessage>
                  )}
                </FormControl>
              </Flex>
            </Collapse>
          </Flex>

          <HStack>
            <Button
              leftIcon={<Icon as={CloseIcon} />}
              variant="primary"
              onClick={() => cancelSubmit()}
            >
              Cancel
            </Button>
            <Button
              variant="gradient_100"
              type="submit"
              leftIcon={<Icon as={ArrowIcon} transform={'rotate(180deg)'} />}
            >
              Submit Game
            </Button>
          </HStack>
        </VStack>
      </form>
    </Box>
  );
};

export default SubmitGameForm;
