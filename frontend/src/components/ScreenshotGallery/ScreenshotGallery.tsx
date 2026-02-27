import { useState } from 'react';
import {
  Box,
  ImageList,
  ImageListItem,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Paper,
  Toolbar,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Theme,
} from '@mui/material';
import {
  Close as CloseIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

interface Screenshot {
  url: string;
  title: string;
  timestamp: string;
}

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  isLoading?: boolean;
  title?: string;
  maxHeight?: string | number;
}

function ScreenshotPreviewDialog({ selectedIndex, screenshots, isMobile, handleClose, handlePrev, handleNext, handleDownload, theme }: {
  selectedIndex: number | null; screenshots: Screenshot[]; isMobile: boolean;
  handleClose: () => void; handlePrev: () => void; handleNext: () => void;
  handleDownload: (s: Screenshot) => void; theme: Theme;
}) {
  return (
    <Dialog open={selectedIndex !== null} onClose={handleClose} maxWidth="lg" fullWidth fullScreen={isMobile}>
      {selectedIndex !== null && (
        <>
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, display: 'flex', gap: 1, bgcolor: 'rgba(0, 0, 0, 0.5)', borderRadius: 1, p: 0.5 }}>
              <IconButton size="small" onClick={() => handleDownload(screenshots[selectedIndex])} sx={{ color: 'white' }}>
                <DownloadIcon />
              </IconButton>
              <IconButton size="small" onClick={handleClose} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: isMobile ? '100vh' : '70vh', bgcolor: theme.palette.background.default }}>
              <IconButton onClick={handlePrev} sx={{ position: 'absolute', left: 8 }}><PrevIcon /></IconButton>
              <img src={screenshots[selectedIndex].url} alt={screenshots[selectedIndex].title} style={{ maxWidth: '100%', maxHeight: isMobile ? '100vh' : '70vh', objectFit: 'contain' }} />
              <IconButton onClick={handleNext} sx={{ position: 'absolute', right: 8 }}><NextIcon /></IconButton>
            </Box>
            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0, 0, 0, 0.5)', color: 'white', p: 1 }}>
              <Typography variant="caption">
                {screenshots[selectedIndex].title} -{' '}
                {new Date(screenshots[selectedIndex].timestamp).toLocaleString()}
              </Typography>
            </Box>
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}

export default function ScreenshotGallery({
  screenshots,
  isLoading = false,
  title = 'Screenshots',
  maxHeight = '500px',
}: ScreenshotGalleryProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleOpen = (index: number) => {
    setSelectedIndex(index);
  };

  const handleClose = () => {
    setSelectedIndex(null);
  };

  const handlePrev = () => {
    if (selectedIndex === null) return;
    setSelectedIndex(
      selectedIndex === 0 ? screenshots.length - 1 : selectedIndex - 1
    );
  };

  const handleNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex(
      selectedIndex === screenshots.length - 1 ? 0 : selectedIndex + 1
    );
  };

  const handleDownload = (screenshot: Screenshot) => {
    const link = document.createElement('a');
    link.href = screenshot.url;
    link.download = `screenshot-${screenshot.timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: maxHeight,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper variant="outlined">
      <Toolbar
        variant="dense"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          {title} ({screenshots.length})
        </Typography>
      </Toolbar>

      <Box sx={{ maxHeight, overflow: 'auto', p: 2 }}>
        <ImageList cols={isMobile ? 2 : 3} gap={16}>
          {screenshots.map((screenshot, index) => (
            <ImageListItem
              key={screenshot.url}
              onClick={() => handleOpen(index)}
              sx={{ cursor: 'pointer' }}
            >
              <img
                src={screenshot.url}
                alt={screenshot.title}
                loading="lazy"
                style={{
                  borderRadius: theme.shape.borderRadius,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              />
            </ImageListItem>
          ))}
        </ImageList>
      </Box>

      <ScreenshotPreviewDialog selectedIndex={selectedIndex} screenshots={screenshots} isMobile={isMobile} handleClose={handleClose} handlePrev={handlePrev} handleNext={handleNext} handleDownload={handleDownload} theme={theme} />
    </Paper>
  );
}