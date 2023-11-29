# AppFramework Extensions

Extensions get copied (or symlinked) into the TypeSupport folder of CESMII's [AppFramework](https://github.com/cesmii/AppFramework) to add support for different Types (aka Smart Manufacturing Profiles).

Type Support subfolders, and the value for `typeSupport.machineTypes.` in the subfolder's type.js should match the "internal name" of the type definition in the SMIP. (See WellPumpingStation for an example of how to handle exceptions to this rule.)

They should be written in pure Javascript and CSS against an HTML5 DOM, and load all their dependencies programmatically.