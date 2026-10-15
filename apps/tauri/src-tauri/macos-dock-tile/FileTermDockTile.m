#import <AppKit/AppKit.h>

static void *FileTermDockTileIconPreferenceContext = &FileTermDockTileIconPreferenceContext;

@interface FileTermDockTilePlugin : NSObject <NSDockTilePlugIn>
@property(nonatomic, strong) NSDockTile *dockTile;
@property(nonatomic, strong) NSUserDefaults *preferences;
@property(nonatomic) BOOL observesIconPreference;
@end

@implementation FileTermDockTilePlugin

- (void)setDockTile:(NSDockTile *)dockTile {
  if (self.observesIconPreference) {
    [self.preferences removeObserver:self
                          forKeyPath:@"app_icon"
                             context:FileTermDockTileIconPreferenceContext];
    [self.preferences removeSuiteNamed:@"com.fileterm.desktop"];
    self.observesIconPreference = NO;
  }

  self.dockTile = dockTile;
  if (dockTile == nil) {
    self.preferences = nil;
    return;
  }

  self.preferences = [NSUserDefaults standardUserDefaults];
  [self.preferences addSuiteNamed:@"com.fileterm.desktop"];
  [self.preferences addObserver:self
                     forKeyPath:@"app_icon"
                        options:0
                        context:FileTermDockTileIconPreferenceContext];
  self.observesIconPreference = YES;
  [self refreshDockTile];
}

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary<NSKeyValueChangeKey, id> *)change
                       context:(void *)context {
  if (context == FileTermDockTileIconPreferenceContext) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self refreshDockTile];
    });
    return;
  }
  [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
}

- (void)refreshDockTile {
  if (self.dockTile == nil) {
    return;
  }

  NSString *variant = [self.preferences stringForKey:@"app_icon"] ?: @"classic";
  NSDictionary<NSString *, NSString *> *iconNames = @{
    @"classic": @"dock-classic",
    @"material": @"dock-material",
    @"clean": @"dock-clean",
  };
  NSString *iconName = iconNames[variant] ?: @"dock-classic";
  NSBundle *pluginBundle = [NSBundle bundleForClass:[self class]];
  NSURL *iconURL = [pluginBundle URLForResource:iconName withExtension:@"png"];
  NSImage *image = iconURL == nil ? nil : [[NSImage alloc] initWithContentsOfURL:iconURL];
  if (image == nil) {
    return;
  }

  NSImageView *imageView = [[NSImageView alloc] initWithFrame:NSMakeRect(0, 0, self.dockTile.size.width, self.dockTile.size.height)];
  imageView.image = image;
  imageView.imageScaling = NSImageScaleProportionallyUpOrDown;
  self.dockTile.contentView = imageView;
  [self.dockTile display];
}

- (void)dealloc {
  if (self.observesIconPreference) {
    [self.preferences removeObserver:self
                          forKeyPath:@"app_icon"
                             context:FileTermDockTileIconPreferenceContext];
    [self.preferences removeSuiteNamed:@"com.fileterm.desktop"];
  }
}

@end
